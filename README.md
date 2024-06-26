# Agora Virtual Avatars using MediaPipe
The code in this repo demonstrates how to use MediaPipe and Agora to implement responsive virtual avatars within Agora Live Video streams.

For an explination of the code: View [GUIDE.md](/docs/GUIDE.md)

## Demo
![build deploy to pages workflow](https://github.com/digitallysavvy/agora-mediapipe-readyplayerme/actions/workflows/deploy-to-pages.yaml/badge.svg)  
Ping the token server: [<< Send Ping >>](https://agora-token-server-caak.onrender.com/ping)  
Once token server responds, test the build: [https://digitallysavvy.github.io/agora-mediapipe-readyplayerme/](https://digitallysavvy.github.io/agora-mediapipe-readyplayerme/)

## Setup
1. Clone the repo
1. Copy `.env-example` file and rename to `.env`  

   ```bash
   cp .env-example .env
   ```
1. Set the APP_ID, and TOKEN_SERVER env variables in the .env file

## Test in Dev mode
1. Follow steps in setup
1. Open the terminal and navigate to repo folder
1. Use this command to run dev mode with local webserver: 

```bash
npm run dev
```

## Build for production
1. Follow steps in setup
1. Open the terminal and navigate to repo folder
1. Use this command to run the build script: 

   ```bash
   npm run build
   ```
1. Upload the contents of the new `dist` folder to your webserver
1. Make sure the server has your Agora API key, and Agora Token server url are set in the environment variables using the env variables `VITE_AGORA_APP_ID` & `VITE_AGORA_TOKEN_SERVER_URL`

## Deploy to GitHub Pages
This project is setup with a GitHub actions workflow to deploy the project to GitHub pages, if enabled in the project settings. 

To enable GitHub Pages build via GitHub Actions:
1. Clone or Fork the project (https://github.com/digitallysavvy/agora-mediapipe-readyplayerme/)
1. Click the project's Settings tab
1. Click the Pages tab in the left column menu
1. Under Build and deployment, select GitHub Actions as the Source
1. Click the Environments tab in the left column menu
7. Click github-pages from the Environments list
1. Click Add variable under the Environment variable section
1. Set the name `VITE_AGORA_APP_ID` and your Agora AppId as the value.
1. Repeat step 8 and add `VITE_AGORA_TOKEN_SERVER_URL` and the url to your [agora token service](https://github.com/AgoraIO-Community/agora-token-service) url.
10. (optional) If you used a different name for your github repo, update the `vit.config.js` file to update the url if you change the project name