# Add Realtime 3D Avatars to Live Video Streams

In today’s rapidly evolving digital landscape, live streaming video is dominating real-time communication. Users now expect more immersive and customizable streaming options. Content creators are increasingly seeking creative new ways to stream themselves, giving rise to the demand for dynamic 3D avatars that mirror their movements and expressions. 

Traditionally, real-time virtual avatars required complex motion capture equipment and sophisticated software, often making it inaccessible for everyday users and independent creators. However, artificial intelligence has changed this status quo as well. With advancements in computer vision,it's now possible to run sophisticated Ai aialgorithms on-device that can accurately capture and translate human facial gestures into digital form in real-time.

In this walkthrough, we'll look at how to integrate 3D virtual avatars into your [Agora](https://www.agora.io) live streams using [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) and 3D avatars from [ReadyPlayerMe](https://readyplayer.me/). Whether you're looking to enhance audience engagement or just add a fun, creative twist to your app's video calls/live broadcasts, this guide will provide you with the necessary steps to bring 3D virtual personas to life.

## Prerequisites 
- [Node.JS](https://nodejs.org)
- A developer account with [Agora](https://console.agora.io)
- A basic understanding of HTML/CSS/JS
- A basic understanding of ThreeJS
- A basic understanding of Agora - [Web QuickStart](https://medium.com/agora-io/a-simple-approach-to-building-a-group-video-chat-web-app-0b8a6cacfdfd)
- A code editor, I use [VSCode](https://code.visualstudio.com)
- A 3D avatar from [ReadyPlayerMe](https://readyplayer.me/)

## Agora + MediaPipe project
To keep this guide concise, I'm assuming you have some understanding of how to implement the Agora Video SDK into a web-app. If you dont, check out my guide on [ Building a Group Video Chat Web App](https://medium.com/agora-io/a-simple-approach-to-building-a-group-video-chat-web-app-0b8a6cacfdfd).

To get started, download the [demo project](https://github.com/digitallysavvy/agora-mediapipe-readyplayerme). With the code downloaded, navigate to the project folder in the terminal and use `npm` to install the node pacakges.

```bash
git clone git@github.com:digitallysavvy/agora-mediapipe-readyplayerme.git
cd agora-mediapipe-readyplayerme
npm i 
```

## Core Structure (HTML) 
Let’s start with the html structure in [`index.html`](index.html), at the top of the `<body>` are the "call" UI elements: a container for the remote videos, a container for the local user with buttons for muting and unmuting the audio/video and a button to leave the chat. 

Aside from the call UI, there's an overlay screen that will allow users to input the URL to their avatars, and a button to join the channel.

```HTML
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/agora-box-logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" type="text/css" href="style.css" />
    <title>Agora Live Video Demo</title>
  </head>
  <body>
    <div id="container"></div>
    <div id="local-user-container"></div>
    <div id="local-media-controls">
      <button id="mic-toggle" class="media-active">Mic</button>
      <button id="video-toggle" class="media-active">Video</button>
      <button id="leave-channel" class="media-active">Leave</button>
    </div>
    <div id="overlay" class="modal">
      <div id="form-container">
        <h1 id="form-header">Avatar Video Chat</h1>
        <form id="join-channel-form">
          <div id="form-body">
            <div class="form-group">
              <label for="form-rpm-url">Ready Player Me URL</label>
              <input type="text" id="form-rpm-url" placeholder="http://models.readyplayer.me/<MODEL-ID>.glb" class="form-control">
            </div>
            <div id="form-footer">
              <button type="submit" id="join-channel-btn">Join Channel</button>
            </div>
          </div>
        </form>
      </div>
    </div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

## Agora Client and data stores
In [`main.js`](/main.js) we create a new Agora client to use Agora's SDK and use `localMedia` to keep a reference to the audio, video, and canvas tracks and their active state. We'll need `headRotation` and `blendShapes` to store the data we get from MediPipe's computer vision.
`
```javascript
// Create the Agora Client
const client = AgoraRTC.createClient({ 
  codec: 'vp9',
  mode: 'live',
  role: 'host'
})

const localMedia = {
  audio: {
    track: null,
    isActive: false
  },
  video: {
    track: null,
    isActive: false
  },
  canvas: {
    track: null,
    isActive: false
  },
}

// Container for the remote streams
let remoteUsers = {}                

//  store data from facial landmarks
let headRotation
let blendShapes

```

### DOMContentLoaded and Event Listeners
When the page loads, we'll add listeners for the Agora events, the media controls and form submission. With the listeners in place we're ready to show the overlay form.

```javascript
// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
  // Add the Agora Event Listeners
  addAgoraEventListeners()
  // Add listeners to local media buttons
  addLocalMediaControlListeners()
  // Get the join channel form & handle form submission
  const joinform = document.getElementById('join-channel-form')
  joinform.addEventListener('submit', handleJoin)
  // Show the overlay form
  showOverlayForm(true) 
})
```

> NOTE: Make sure to add client event listensers before joining the channel, otherwise some events may not get triggered as expected.

## 3D & Avatar Setup
When the user clicks the join button, initialize the ThreeJS scene and append the `<canvas>`  to  the `localUserContainer`. After the scene is created, load the avatar using the `glbURL` from the user. After the 3D avatar is loaded, we'll traverse it's scene graph and create a an object with all the nodes. This will give us quick access to the `headMesh`. 

There is a noticable delay between the time it takes to initialize the scene to the moment the 3D avatar is loaded and ready for use. To let the user know it's loading it's good practice to display a loading animation and remove it once the 3D avatar is added to the scene.

```javascript
// get the local-user container div
const localUserContainer = document.getElementById('local-user-container') 

// show a loading animation
const loadingDiv = document.createElement('div')
loadingDiv.classList.add('lds-ripple')
loadingDiv.append(document.createElement('div'))
localUserContainer.append(loadingDiv)

// create the scene and append canvas to localUserContainer
const { scene, camera, renderer } = await initScene(localUserContainer)

// append url parameters to glb url - load ReadyPlayerMe avatar with morphtargets
const rpmMorphTargetsURL = glbURL + '?morphTargets=ARKit&textureAtlas=1024'
let nodes
// Load the GLB with morph targets
const loader = new GLTFLoader()
loader.load(rpmMorphTargetsURL, 
  async (gltf) => {
  const avatar = gltf.scene
  // build graph of avatar nodes
  nodes =  await getGraph(avatar)
  const headMesh = nodes['Wolf3D_Avatar']
  // adjust position 
  avatar.position.y = -1.65
  avatar.position.z = 1
  
  // add avatar to scene
  scene.add(avatar)
  // remove the loading spinner
  loadingDiv.remove()
},
(event) => {
  // outout loading details
  console.log(event)
})
```

> Note: There is a noticable delay when loading 3D avatars directly from ReadyPlayerMe.

## Init video element with Agora
We're going to use Agora to get camera access and create our video and audio tracks. We'll use the camera's video track as the the source for the video element. If you'd like a deeper explanation check out my guide on using [Agora with custom video elements](https://medium.com/agora-io/custom-video-elements-with-javascript-and-agora-web-sdk-3c70d5dc1e09).

```javascript
// Init the local mic and camera
await initDevices('music_standard', '1080_3')
// Create video element
const video = document.createElement('video')
video.setAttribute('webkit-playsinline', 'webkit-playsinline');
video.setAttribute('playsinline', 'playsinline');
// Create a new MediaStream using camera track and set it the video's source object
video.srcObject = new MediaStream([localMedia.video.track.getMediaStreamTrack()])
```
## MediaPipe Setup
Before we can detect faces and facial gestures, we need to download the lastest WASM files for MediaPipe's computer vision and configure a `FaceLandmarker` task. In the face landmarks configuration, we'll set the `faceLandmarker` to ouput blendshape weights and facial transformations. These two settings are important because when we run the prediction loop we'll need access to that data. 

```javascript
// initialize MediaPipe vision task
const faceLandmarker = await initVision()

// init MediaPipe vision
const initVision = async () => {
  // load latest Vision WASM
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm')
  // configure face landmark tracker
  const faceLandmarker = await FaceLandmarker.createFromOptions(
    vision, { 
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO'
    })
  return faceLandmarker
}
```

### Computer Vision Prediction Loop
With the `faceLandmarker` and `<video/>` set up, we can start a prediction loop to run MediaPipe's coputer vision task on every frame of the video. As the prediction returns a result called it will give us access to the `facialTransformationMatrixes` which allow us to calculate the `headRotation`. The prediction result also gives us estimated blendshape weights for the face mesh. 

``` javascript 
video.addEventListener("loadeddata", () => {
  video.play()                            // start video playback
  initPredictLoop(faceLandmarker, video)  // start face landmarks prediction loop
})

const initPredictLoop = (faceLandmarker, video) => {
  // flag to keep track of stream's playbacktime
  let lastVideoTime = -1
  // prediction loop
  const predict = () => {
    // create a timestamp
    const timeInMs = Date.now()
    // while video is still streaming
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime
      // run vison task to detect faces in video frame
      const result = faceLandmarker.detectForVideo(video, timeInMs)
      // get face matrix transformation for face 1
      const faceMatrix = result.facialTransformationMatrixes
      if (faceMatrix && faceMatrix.length > 0) {
        const matrix = new THREE.Matrix4().fromArray(faceMatrix[0].data)
        headRotation =  new THREE.Euler().setFromRotationMatrix(matrix)
      }
      // get blendshape predictions for face 1
      const blendShapePredictions = result.faceBlendshapes
      if (blendShapePredictions && blendShapePredictions.length > 0){
        blendShapes = blendShapePredictions[0].categories
      }
    }
    // predect om every frame update
    requestAnimationFrame(predict)
  }
  // start loop
  requestAnimationFrame(predict)
}
```

## Commuter Vision + 3D Avatar
To render the ThreeJS scene we use a render loop. When we initialize the render loop we'll pass a function to update the head rotation and blendshape intensity using the results of the prediction loop.

```javascript
// create the render loop
const initRenderLoop = (scene, camera, renderer, sceneUpdates) => {
  const render = (time) => {
    // update the scene 
    sceneUpdates(time)
    // render scene using camera
    renderer.render(scene, camera)
    // add render back to the call stack
    requestAnimationFrame(render)
  }
  // start render loop
  requestAnimationFrame(render)
}

initRenderLoop(scene, camera, renderer, (time) => {
  // return early if nodes or head rotation are null
  if(!nodes || !headRotation) return
  // apply rotatation data to head, neck, and shoulders bones
  nodes.Head.rotation.set(headRotation.x, headRotation.y, headRotation.z)
  nodes.Neck.rotation.set(headRotation.x/2, headRotation.y/2, headRotation.z/2)
  nodes.Spine1.rotation.set(headRotation.x/3, headRotation.y/3, headRotation.z/3)
  // loop through the blendshapes
  blendShapes.forEach(blendShape => {
    const headMesh = nodes.Wolf3D_Avatar
    const blendShapeIndex = headMesh.morphTargetDictionary[blendShape.categoryName]
    if (blendShapeIndex >= 0) {
      headMesh.morphTargetInfluences[blendShapeIndex] = blendShape.score
    }
  })
})
```

You may notice that by default the mouth movement is only visible when you exagerate your facial expressions. This isn't typically how people's face moves when they speak. To make the avatar appear more responsive we can exagerate the blendshape scores. 

Make a list of the blendshapes we want to target, set a multiplier for the base score, along with upper and lower thresholds for when to apply the exagerations. The threshold helps us avoid exagerating the blendshapes when the mouth should be closed or when the user's expression is already exagerated. 

```javascript
// mouth blendshapes
const mouthBlendshapes = [
  'mouthSmile_L', 'mouthSmile_R', 'mouthFrown_L','mouthFrown_R',
  'mouthOpen', 'mouthPucker','mouthWide','mouthShrugUpper','mouthShrugLower',
]
// multipliyer to embelish mouth movement
const exagerationMultiplier = 1.5
const threshold ={ min: 0.25, max: 0.6}
```

While we're looping through the blendshaps to apply the score, check for the mouth blendshapes and if they're within the threshold. 

```javascript
 // loop through the blendshapes
blendShapes.forEach(blendShape => {
  const headMesh = nodes.Wolf3D_Avatar
  const blendShapeIndex = headMesh.morphTargetDictionary[blendShape.categoryName]
  if (blendShapeIndex >= 0) {
    // exagerate the score for the mouth blendshapes
    if (mouthBlendshapes.includes[blendShape.categoryName] && blendShape.score > threshold.min && blendShape.score < threshold.max ) {
      blendShape.score *= exagerationMultiplier
    }
    headMesh.morphTargetInfluences[blendShapeIndex] = blendShape.score
  }
})
```

## ThreeJS to Agora Video Stream
The render loop renders the 3D scene onto a canvas. To publish the scene from the `<canvas>` into Agora, create a `captureStream` and use the video track to initialize a custom video track. If you'd like a deeper explanation check out my guide on how to [Create an Agora Video Track using a Canvas Element](https://medium.com/agora-io/custom-video-elements-with-javascript-and-agora-web-sdk-3c70d5dc1e09).

```javascript
  // Get the canvas
  const canvas = renderer.domElement
  // Set the frame rate
  const fps = 30
  // Create the captureStream
  const canvasStream = canvas.captureStream(fps)
  // Get video track from canvas stream
  const canvasVideoTrack = canvasStream.getVideoTracks()[0]
  // use the canvasVideoTrack to create a custom Agora Video track
  const customAgoraVideoTrack = AgoraRTC.createCustomVideoTrack({
    mediaStreamTrack: canvasVideoTrack,
    frameRate: fps
  })
  localMedia.canvas.track = customAgoraVideoTrack
  localMedia.canvas.isActive = true
  // publish the canvas track into the channel
  await client.publish([localMedia.audio.track, localMedia.canvas.track])
```

## Next Steps
And there you have it, how to use  Agora’s Video SDK for Web with MediaPipe's computer vision to enable custom 3D avatars. This example is a great base for building more complex ai driven features for extending reality, whether for engaging webinars, interactive education platforms, or any other application where live video plays a key role. Feel free to tweak, transform, and take this code to new heights!

## Other Resources
- Dive into the [Agora Documentation]() to better understand the features and capabilities of the Agora SDK. Explore the API reference, sample codes, and best practices.
- Be part of the Agora developer community: Join the conversation on [X(Twitter)](https://twitter.com/AgoraIO), or [LinkedIn(https://www.linkedin.com/company/agora-lab-inc/)] to share experiences, and stay updated on the latest developments.
- Need support? Reach out via [StackOverflow](https://stackoverflow.com/questions/tagged/agora.io) for advice on your implementation.