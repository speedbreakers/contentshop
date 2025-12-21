Product:
- add product modal - Done
- description generation - Done
- credits system - Done
- infographics workflow - Done
- garment workflow implementation - Done
- shopify link - Done
- make moodboard look good with small tiles of assets attached - Done
- use nextjs image component - Done
- show pills and download button on image on hover in view asset modal - Done
- allow switching between images in the folder in the view asset modal - Done
- Sync modal - on clicking sync the button keeps showing starting... - Done
- clicking on storefront should take inside - Done
- useSwr everywhere - Done
- generating 10 images results in timeout on the frontend - Done
- if the user gives custom instructions for every generation in one text how do you handle that - Done
- moodboard strictness - Done
- added references to moodboard - Done
- generation output should generate based on inputs - Done
- generation form has better UX now - Done
- aspect ratio setting - Done

- non-garment workflow implementation 
- infographics workflow implementation
- description workflow implementation
- garment workflow prompts
- invite team members email
- plan upgrade / downgrade flow
- model and background library
- onboarding
- change all id fields to ulid
- optimizations with kv
- nano banana retry
- applying moodboard properly
- remove home page
- batch processing bugs
- show unfinished jobs on variant page on reload
- remove image file names in moodboard page

- allow batch generation from product screen
- remove batch from main nav and replace with tasks (tasks shows all generation tasks)

UI Issues:
- flow for storefronts is not smooth
- on clicking connect in storefront show a loader
- add better loaders
- review all empty states
- review copy (some parts are difficult to understand)

Business:
- stripe setup
- change gemini creds on ai gateway



Process Jobs
curl http://localhost:4200/api/commerce/cron/process-jobs

Delete data
curl -X DELETE "http://localhost:4200/api/user?userId=1" \
  -H "Authorization: Bearer MSxpq12p4045ofdkm2350as012dklm32501pmglLkd"