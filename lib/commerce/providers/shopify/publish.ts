/**
 * Shopify Publish Variant Media
 *
 * Publishes generated images to Shopify variant media.
 * Uses the 3-step process: staged upload → file create → variant append.
 */

import { getShopifyClient } from './client';
import type {
  PublishParams,
  PublishResult,
  ShopifyStagedTarget,
  ShopifyUserError,
} from '../types';

// GraphQL mutations for publishing

const STAGED_UPLOADS_CREATE = `
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_CREATE = `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage {
          id
          image {
            url
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PRODUCT_VARIANT_APPEND_MEDIA = `
  mutation ProductVariantAppendMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) {
    productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) {
      product {
        id
      }
      productVariants {
        id
        media(first: 5) {
          edges {
            node {
              ... on MediaImage {
                id
                image {
                  url
                }
              }
            }
          }
        }
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

/**
 * Step 1: Create staged upload target
 */
async function createStagedUpload(
  accountId: number,
  filename: string,
  mimeType: string = 'image/png'
): Promise<ShopifyStagedTarget> {
  const client = await getShopifyClient(accountId);

  const response = await client.mutation<{
    stagedUploadsCreate: {
      stagedTargets: ShopifyStagedTarget[];
      userErrors: ShopifyUserError[];
    };
  }>(STAGED_UPLOADS_CREATE, {
    input: [
      {
        filename,
        mimeType,
        httpMethod: 'POST',
        resource: 'PRODUCT_IMAGE',
      },
    ],
  });

  const { stagedTargets, userErrors } = response.data?.stagedUploadsCreate ?? {};

  if (userErrors?.length) {
    throw new Error(`Staged upload failed: ${userErrors[0].message}`);
  }

  if (!stagedTargets?.[0]) {
    throw new Error('No staged upload target returned');
  }

  return stagedTargets[0];
}

/**
 * Step 2: Upload file to staged target
 */
async function uploadToStagedTarget(
  stagedTarget: ShopifyStagedTarget,
  imageBuffer: ArrayBuffer,
  filename: string
): Promise<void> {
  const formData = new FormData();

  // Add all parameters from staged upload
  for (const param of stagedTarget.parameters) {
    formData.append(param.name, param.value);
  }

  // Add the file
  formData.append('file', new Blob([imageBuffer]), filename);

  const response = await fetch(stagedTarget.url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload to staged target failed: ${response.status} ${errorText}`);
  }
}

/**
 * Step 3: Create media on product
 */
async function createProductMedia(
  accountId: number,
  resourceUrl: string
): Promise<string> {
  const client = await getShopifyClient(accountId);

  const response = await client.mutation<{
    fileCreate: {
      files: Array<{ id: string; fileStatus: string }>;
      userErrors: ShopifyUserError[];
    };
  }>(FILE_CREATE, {
    files: [
      {
        contentType: 'IMAGE',
        originalSource: resourceUrl,
      },
    ],
  });

  const { files, userErrors } = response.data?.fileCreate ?? {};

  if (userErrors?.length) {
    throw new Error(`File create failed: ${userErrors[0].message}`);
  }

  if (!files?.[0]?.id) {
    throw new Error('No media ID returned from file create');
  }

  return files[0].id;
}

/**
 * Step 4: Attach media to variant
 */
async function appendMediaToVariant(
  accountId: number,
  productId: string,
  variantId: string,
  mediaId: string
): Promise<void> {
  const client = await getShopifyClient(accountId);

  const response = await client.mutation<{
    productVariantAppendMedia: {
      product: { id: string } | null;
      productVariants: Array<{ id: string }>;
      userErrors: ShopifyUserError[];
    };
  }>(PRODUCT_VARIANT_APPEND_MEDIA, {
    productId,
    variantMedia: [
      {
        variantId,
        mediaIds: [mediaId],
      },
    ],
  });

  const { userErrors } = response.data?.productVariantAppendMedia ?? {};

  if (userErrors?.length) {
    throw new Error(`Append media failed: ${userErrors[0].message}`);
  }
}

/**
 * Publish a generated image to a Shopify variant
 *
 * Full flow:
 * 1. Download image from ContentShop blob
 * 2. Create staged upload in Shopify
 * 3. Upload image to staged target
 * 4. Create media from staged upload
 * 5. Attach media to variant
 */
export async function publishVariantMedia(
  params: PublishParams
): Promise<PublishResult> {
  const { accountId, externalProductId, externalVariantId, imageUrl, filename } = params;

  try {
    // 1. Download image from ContentShop
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // 2. Create staged upload
    const stagedTarget = await createStagedUpload(accountId, filename);

    // 3. Upload to staged target
    await uploadToStagedTarget(stagedTarget, imageBuffer, filename);

    // 4. Create media
    const mediaId = await createProductMedia(accountId, stagedTarget.resourceUrl);

    // 5. Attach to variant
    await appendMediaToVariant(
      accountId,
      externalProductId,
      externalVariantId,
      mediaId
    );

    return {
      mediaId,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Shopify Publish Error]', errorMessage);

    return {
      mediaId: '',
      success: false,
      error: errorMessage,
    };
  }
}

