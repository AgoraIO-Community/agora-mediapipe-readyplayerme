import AgoraRTC from 'agora-rtc-sdk-ng'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { initScene, initRenderLoop, getGraph } from './threeD'
import { showOverlayForm, createUserContainer, removeUserContainer, addVideoDiv, removeVideoDiv } from './ui'

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

const Loglevel = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  NONE: 4
}

AgoraRTC.enableLogUpload()                       // Auto upload logs to Agora
AgoraRTC.setLogLevel(Loglevel.ERROR)             // Set Loglevel

// 
let headRotation
let blendShapes

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('page-loaded')
  addAgoraEventListeners()                          // Add the Agora Event Listeners
  addLocalMediaControlListeners()                   // Add listeners to local media buttons
  const joinform = document.getElementById('join-channel-form')     // Get the join channel form
  joinform.addEventListener('submit', handleJoin)   // Add the function to handle form submission
  showOverlayForm(true)                             // Show the overlay form
  
})

// User Form Submit Event
const handleJoin = async (event) => {
  // stop the page from reloading
  event.preventDefault()                            
  // Get the channel name from the form input and remove any extra spaces
  const glbInput = document.getElementById('form-rpm-url')
  const glbURL = glbInput.value.trim()
  // Check if the channel name is empty  
  if (!glbURL || glbURL === '') {
    // Show error message and return early
    glbInput.labels[0].style.color = '#F00'
    glbInput.labels[0].textContent = '(Required) Ready Player Me URL'
    return
  }

  // get the local-user container div
  const localUserContainer = document.getElementById('local-user-container') 
  
  // show a loading animation
  const loadingDiv = document.createElement('div')
  loadingDiv.classList.add('lds-ripple')
  loadingDiv.append(document.createElement('div'))
  localUserContainer.append(loadingDiv)

  // start the animation when the page loads
  const { scene, camera, renderer } = await initScene(localUserContainer)
  
  // use glb url to load Ready Player Me Avatar with morphtargets
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
    
    // TODO: remove testing output
    console.log(avatar)
    console.log(headMesh)
    // add avatar to scene
    scene.add(avatar)
    // remove the loading spinner
    loadingDiv.remove()
  },
  (event) => {
    // outout loading details
    console.log(event)
  })

  // initialize MediaPipe vision task
  const faceLandmarker = await initVision()

  // Init the local mic and camera
  await initDevices('music_standard', '1080_3')
  // Create video element
  const video = document.createElement('video')
  video.setAttribute('webkit-playsinline', 'webkit-playsinline');
  video.setAttribute('playsinline', 'playsinline');
  // Create a new MediaStream using camera track and set it the video's source object
  video.srcObject = new MediaStream([localMedia.video.track.getMediaStreamTrack()])
  // wait for source to finish loading
  video.addEventListener("loadeddata", () => {
    video.play()                            // start video playback
    initPredictLoop(faceLandmarker, video)  // start face landmarks prediction loop
  })

  // list of the mouth blend shapes
  const mouthBlendShapes = [
    'mouthSmile_L', 'mouthSmile_R', 'mouthFrown_L','mouthFrown_R',
    'mouthOpen', 'mouthPucker','mouthWide','mouthShrugUpper','mouthShrugLower',
  ]
  // multipliyer to embelish mouth movement
  const exagerationMultiplier = 1.5
  const threshold ={ min: 0.25, max: 0.6}
  
  initRenderLoop(scene, camera, renderer, (time) => {
    // return early if nodes or head rotation are null
    if(!nodes || !headRotation) return
    // apply rotatation data to head, neck, and shoulders bones
    nodes.Head.rotation.set(headRotation.x, headRotation.y, headRotation.z)
    nodes.Neck.rotation.set(headRotation.x/2, headRotation.y/2, headRotation.z/2)
    nodes.Spine1.rotation.set(headRotation.x/3, headRotation.y/3, headRotation.z/3)
    // loop through the blend shapes
    blendShapes.forEach(blendShape => {
      const headMesh = nodes.Wolf3D_Avatar
      const blendShapeIndex = headMesh.morphTargetDictionary[blendShape.categoryName]
      if (blendShapeIndex >= 0) {
        // exaggerate the score for the mouth blend shapes
        if (mouthBlendShapes.includes[blendShape.categoryName] && blendShape.score > threshold.min && blendShape.score < threshold.max ) {
          blendShape.score *= exagerationMultiplier
        }
        headMesh.morphTargetInfluences[blendShapeIndex] = blendShape.score
      }
    })
  })
 
  const url = new URL(window.location.href)
  const params = new URLSearchParams(url.search)
  // generate a channel name if url param is not defined
  const channelName = params.get('c') ?? generateChannelName()
   // Join the channel
  const appid = import.meta.env.VITE_AGORA_APP_ID
  const uid = 0
  const token = await getRtcToken(uid, channelName, 'publisher') 
  const localUid = await client.join(appid, channelName, token, uid)

  // update the url
  if (!params.has('c')){
     // use url params to pass the channel name
    url.searchParams.set('c', channelName)
    window.history.pushState({}, "", url)
  }
  console.log(`joinedChannel with uid: ${localUid}`)

  // Get video stream from canvas
  const canvas = renderer.domElement
  const fps = 30
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
  await client.publish([localMedia.audio.track, localMedia.canvas.track])
  console.log('publishedTracks')

  // Hide overlay form
  showOverlayForm(false)
  // show media controls (mic, video, leave)            
  document.getElementById('local-media-controls').style.display = 'block'   
}

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

const initPredictLoop = (faceLandmarker, video) => {
  // flag to keep track of video stream's time
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
      // get blend shape predictions for face 1
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

// initialize mic and camera devices using Agora
const initDevices = async (audioConfig, cameraConfig) => {
  if (!localMedia.audio.track || !localMedia.video.track) {
    [ localMedia.audio.track, localMedia.video.track ] = await AgoraRTC.createMicrophoneAndCameraTracks({ audioConfig: audioConfig, videoConfig: cameraConfig })
  }
  // track audio state locally
  localMedia.audio.isActive = true
  localMedia.video.isActive = true
}

// Add client Event Listeners -- on page load
const addAgoraEventListeners = () => {
  console.log(`Event Listeners added`)
  // Add listeners for Agora Client Events
  client.on('user-joined', handleRemotUserJoined)
  client.on('user-left', handleRemotUserLeft)
  client.on('user-published', handleRemotUserPublished)
  client.on('user-unpublished', handleRemotUserUnpublished)
}

// New remote users joins the channel
const handleRemotUserJoined = async (user) => {
  const uid = user.uid
  remoteUsers[uid] = user         // add the user to the remote users list
  console.log(`User ${uid} joined the channel`)
  await createUserContainer(uid)  
}

// Remote user leaves the channel
const handleRemotUserLeft = async (user, reason) => {
  const uid = user.uid
  delete remoteUsers[uid]
  console.log(`User ${uid} left the channel with reason:${reason}`)
  await removeUserContainer(uid)
}

// Remote user publishes a track (audio or video)
const handleRemotUserPublished = async (user, mediaType) => {
  const uid = user.uid
  await client.subscribe(user, mediaType)
  remoteUsers[uid] = user                       // update remote user reference
  if (mediaType === 'video') { 
    addVideoDiv(uid)                            // create remote user div       
    user.videoTrack.play(`user-${uid}-video`)   // play video on remote user div     
  } else if (mediaType === 'audio') {
    user.audioTrack.play()
  }
}

// Remote user unpublishes a track (audio or video)
const handleRemotUserUnpublished = async (user, mediaType) => {
  const uid = user.uid
  console.log(`User ${uid} unpublished their ${mediaType}`)
  if (mediaType === 'video') {
   removeVideoDiv(uid)  // remove video div
  }
}

// Add button listeners
const addLocalMediaControlListeners = () => {
  // get buttons
  const micToggleBtn = document.getElementById('mic-toggle')
  const videoToggleBtn = document.getElementById('video-toggle')
  const leaveChannelBtn = document.getElementById('leave-channel')
  // Add clicks listners 
  micToggleBtn.addEventListener('click', handleMicToggle)
  videoToggleBtn.addEventListener('click', handleVideoToggle)
  leaveChannelBtn.addEventListener('click', handleLeaveChannel)
}

const handleMicToggle = async (event) => {
  const isTrackActive = localMedia.audio.isActive                         // Get current audio state
  await muteTrack(localMedia.audio.track, isTrackActive, event.target)    // Mute/Unmute
  localMedia.audio.isActive = !isTrackActive                              // Invert the audio state
}

const handleVideoToggle = async (event) => {
  const isTrackActive = localMedia.canvas.isActive                         // Get current canvas state
  await muteTrack(localMedia.canvas.track, isTrackActive, event.target)    // Mute/Unmute
  localMedia.canvas.isActive = !isTrackActive                              // Invert the video state
}

// Single function to mute audio/video tracks, using their common API
const muteTrack = async (track, mute, btn) => {
  if (!track) return                      // Make sure the track exists
  await track.setMuted(mute)              // Mute the Track (Audio or Video)
  btn.classList.toggle('media-active')    // Add/Remove active class
  btn.classList.toggle('muted')           // Add/Remove muted class
}

const handleLeaveChannel = async () => {
  // loop through and stop the local tracks
  for (let mediaType in localMedia) {
    const track = localMedia[mediaType].track
    if (track) {
      track.stop()
      track.close()
      localMedia[mediaType].track = null
      localMedia[mediaType].isActive = false // reset the active flags
    }
  }
  // Leave the channel
  await client.leave()
  console.log("client left channel successfully")
  // Reset remote users 
  remoteUsers = {} 
  // Reset the UI
  const mediaButtons = [document.getElementById('mic-toggle'), document.getElementById('video-toggle')]
  mediaButtons.forEach(btn => {
    btn.classList.add('media-active')     // Add media-active class
    btn.classList.remove('muted')         // Remove mute class
  });
  document.getElementById('container').replaceChildren()                   // Clear the remote user divs
  document.getElementById('local-user-container').replaceChildren()       // Clear the local-user div
  document.getElementById('local-media-controls').style.display = 'none'   // hide media controls (mic, video, leave etc)
  showOverlayForm(true)                                                    // Show the Join Form overlay
}

const getRtcToken = async (uid, channelName, role, expiration = 3600) => {
  // Token-Server using: AgoraIO-Community/agora-token-service
  const tokenServerURL = import.meta.env.VITE_AGORA_TOKEN_SERVER_URL + '/getToken'
  const tokenRequest = {
    "tokenType": "rtc",
    "channel": channelName,
    "uid": `${uid}`,
    "role": role,
    "expire": expiration // optional: expiration time in seconds (default: 3600)
  }

  try {
    const tokenFetchResposne = await fetch(tokenServerURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }, 
      body: JSON.stringify(tokenRequest)
    })
    const data = await tokenFetchResposne.json()
    return data.token

  } catch (error) {
    console.log(`fetch error: ${error}`)
  }
}

const generateChannelName = () => {
  const characters = 'abcdefghijklmnopqrstuvwxyz'
  let randString = ''
  for (let i=0; i < 9; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length)
    randString += characters.charAt(randomIndex)
    if ( (i+1)%3 == 0 && i < 8 ) {
      randString += '-'
    }
  }
  console.log(`channelName: ${randString}`)
  return randString
}

