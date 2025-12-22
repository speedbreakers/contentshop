---
name: Home Page Implementation Plan
overview: Implement a public-facing landing page at the root route (`/`) by moving the logic from the dashboard route group to the root, ensuring a proper marketing layout separate from the dashboard sidebar.
todos:
  - id: delete-dashboard-page
    content: Delete app/(dashboard)/page.tsx
    status: completed
  - id: create-landing-page
    content: Create app/page.tsx with auth check and landing page UI
    status: completed
    dependencies:
      - delete-dashboard-page
---

