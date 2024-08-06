# Karnot Cloud Pro GitHub Action

This GitHub Action streamlines deploying your applications to Karnot Cloud Pro.

## Features

* **Secure Karnot Access:** Seamlessly integrates with your @karnotxyz cloud credentials.
* **YAML Configuration:** Define your services and deployment parameters in a clear, concise YAML file.
* **Automated Workflow Setup:**  Easily add the Action to your repository's workflow for automatic deployments on specific events (e.g., pushes to `main`).
* **Real-time CI Progress:**  Track the status of your deployments directly in your GitHub Actions console.

## Getting Started

1. **Get Your Karnot Access:**
    * Get your creds from Karnot Team.
    * Store these credentials as GitHub Secrets in your repository:
        * `KARNOT_API_KEY` (or `KARNOT_ACCESS_TOKEN`)

2. **Add the Workflow:**
    * Create a new workflow file in your repository (e.g., `.workflows/karnot-deploy.yaml`).
    * Paste the following template and modify it as needed:

   ```yaml
   name: Karnot Cloud Pro Deployment

   on:
    workflow_dispatch:
      inputs:
        environment:
          description: 'Environment to deploy'
          required: true
          type: choice
          options:
            - org-sepolia
            - org-staging

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
        - uses: actions/checkout@v3
        - name: Debug Information
          run: |
              echo "Selected environment: ${{ github.event.inputs.environment }}"
              echo "Current directory: $(pwd)"
              echo "Directory contents:"
              ls -R

        - name: Deploy to Karnot Cloud
          uses: karnotxyz/kcloud-pro-github-action@v0
          with:
            input_file: '.workflows/karnot-services.yaml' # Specify your file
            environment: ${{ github.event.inputs.environment }}
            KARNOT_CLOUD_URL: ${{ secrets.KARNOT_CLOUD_URL }}
            KARNOT_CLOUD_TOKEN: ${{ secrets.KARNOT_CLOUD_TOKEN }}
   ```
## Support
For issues or feature requests, please open an issue. For any other inquiries, please contact the Karnot Team.

## License
This GitHub Action is distributed under the MIT License.