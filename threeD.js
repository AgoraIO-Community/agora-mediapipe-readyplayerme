import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/Addons.js'

export const initScene = async (containerDiv) => {
  const divBoundingRect = containerDiv.getBoundingClientRect()
  // create a new scene & camera
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(25, divBoundingRect.width/divBoundingRect.height, 0.1, 1000)
  camera.position.z = 2
  // create new threejs renderer
  const renderer = new THREE.WebGLRenderer({  antialias: true })
  renderer.setSize(divBoundingRect.width, divBoundingRect.height, false)

  // add resize listener
  const resizeCanvas = () => {
    const divBoundingRect = containerDiv.getBoundingClientRect()
    console.log(`width: ${divBoundingRect.width}`)
    renderer.setSize(divBoundingRect.width, divBoundingRect.height)
    camera.aspect = divBoundingRect.width / divBoundingRect.height
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resizeCanvas)

  // add lighting to the scene using HDR
  addHdr(scene)
  renderer.domElement.id = 'local-user'
  containerDiv.appendChild(renderer.domElement)

  return { 
    scene: scene,
    camera: camera,
    renderer: renderer
  }
}

export const updateCanvasSize = (camera, renderer) => {
  const containerDiv = document.getElementById('container')
  const divBoundingRect = containerDiv.getBoundingClientRect()
  renderer.setSize(divBoundingRect.width, divBoundingRect.height)
  camera.aspect = divBoundingRect.width / divBoundingRect.height
  camera.updateProjectionMatrix()
}

// create and start a render loop
export const initRenderLoop = (scene, camera, renderer, sceneUpdates) => {
  const render = (time) => {
    requestAnimationFrame(render)
    // modify the scene pass
    sceneUpdates(time)
    // render scene using camera
    renderer.render(scene, camera)
  }
  // start render loop
  requestAnimationFrame(render)
}

// Traverse model's graph and return array of nodes
export const getGraph = async (model) => {
  const modelNodes =  {}

  const traverse = (node) => {
    modelNodes[node.name] = node
    if (node.children && node.children.length > 0) {
      node.children.forEach ( child => { traverse(child) } )
    }
  }

  traverse(model)

  return modelNodes
}

// Use lights to illuminate the scene
const addLightsToScene = (scene) => {
  // add lights
  const ambientLight = new THREE.AmbientLight( 0x404040, 0.75 ) // soft white light
  scene.add( ambientLight )
  const pointLight1 =  new THREE.PointLight( 0xffffff, 1, 75 );
  pointLight1.position.set(1.25, 1, 2 );
  scene.add( pointLight1 );
  const pointLight2 =  new THREE.PointLight( 0xffffff, 1, 75 );
  pointLight2.position.set( -1.25, 0, 2.1);
  scene.add( pointLight2 )
}

// Use an HDR image for lighting and background
const addHdr = (scene) => {
  console.log('loading hdri')
  const rgbeLoader = new RGBELoader()
  rgbeLoader.setPath('')
  rgbeLoader.load('metro_noord_1k.hdr', (texture) => {
    console.log('hdri loaded')
    texture.mapping = THREE.EquirectangularReflectionMapping
    scene.environment = texture
    scene.background = texture
    // scene.background = new THREE.Color( 0xffffff )
    console.log('added hdri as environment map')
  })
}