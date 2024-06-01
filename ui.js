
// Toggle the visibility of the Join channel form
export const showOverlayForm = (visible) => {
  console.log('toggle-overlay')
  const modal = document.getElementById('overlay')
  if (visible) {
    // modal.style.display = 'block'
    requestAnimationFrame(() => {
      modal.classList.add('show')
    })
  } else {
    modal.classList.remove('show')
  }
}

// create the user container and video player div
export const createUserContainer = async (uid) => {
  // return early if div exists 
  if (document.getElementById(`user-${uid}-container`)) return
  console.log(`add remote user div for uid: ${uid}`)
  // create a container for the remote video stream
  const containerDiv = document.createElement('div')
  containerDiv.id = `user-${uid}-container`
  containerDiv.classList.add('user')
  // containerDiv.textContent = `0x${uid}`
  setColors(containerDiv) 
  // Add remote user to remote video container
  document.getElementById('container').appendChild(containerDiv)
  adjustGrid()

  return containerDiv
}

// Remove the div when users leave the channel
export const removeUserContainer = async (uid) => {
  const containerDiv = document.getElementById(`user-${uid}-container`)
  if (containerDiv) {
    containerDiv.parentNode.removeChild(containerDiv)
    adjustGrid()
  } 
}

// create and add a new div element with id
export const addVideoDiv = (uid) => {
  const divId = `user-${uid}-video`
  // return early if div exists 
  if (document.getElementById(divId)) return
  // create a div to display the video track
  const remoteUserDiv = document.createElement('div')
  remoteUserDiv.id = divId
  remoteUserDiv.classList.add('remote-video')
  document.getElementById(`user-${uid}-container`).appendChild(remoteUserDiv)
  // return div
  return remoteUserDiv
}

// remove div element with id
export const removeVideoDiv = async (uid) => {
  const divId = `user-${uid}-video`
  const videoDiv = document.getElementById(divId)
  if (videoDiv) {
    videoDiv.remove()
  }
}

// clear container content
export const emptyContainer = async () => {
  const contianer = document.getElementById('container')
  contianer.replaceChildren([])
  adjustGrid()
}

// adjust the container grid layout
const adjustGrid = () => {
  const contianer = document.getElementById('container')
  const divs = contianer.querySelectorAll('.user')
  const numDivs = divs.length > 0 ? divs.length : 1
  let cols = Math.ceil(Math.sqrt(numDivs))
  let rows = Math.ceil(numDivs/cols)

  contianer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
  contianer.style.gridTemplateRows = `repeat(${rows}, 1fr)`
}


const setColors = (div) => {
  // create random background color
  const hue = Math.random() * 360
  const saturation =  Math.random() * 100
  const lightness = (Math.random() * 60) + 20
  div.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`

  // calculate complimentary color and lightness for the text
  const complimentHue = (hue + 180) * 360
  const complimentLightness = lightness < 50 ? 80 : 20
  div.style.color = `hsl(${complimentHue}, ${saturation}%, ${complimentLightness}%)` 
}