let audioContext = null
const nodes = new Map()
const elementSources = new WeakMap()

function scheduleParam(param, value) {
  if (audioContext?.state === 'running') {
    param.setTargetAtTime(value, audioContext.currentTime, 0.01)
  } else {
    param.value = value
  }
}

export async function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
  return audioContext
}

export function hasMixerNode(slotId) {
  return nodes.has(slotId)
}

export async function attachToMixer(slotId, audioElement, volume = 0.7, pan = 0) {
  const ctx = await getAudioContext()
  const existing = nodes.get(slotId)

  // iOS routes media-element volume into Web Audio; keep at 1 and use gain node.
  audioElement.volume = 1

  if (existing?.audio === audioElement) {
    scheduleParam(existing.gain.gain, volume)
    scheduleParam(existing.panner.pan, pan)
    return { gain: existing.gain, panner: existing.panner }
  }

  detachFromMixer(slotId)

  let source = elementSources.get(audioElement)
  if (!source) {
    source = ctx.createMediaElementSource(audioElement)
    elementSources.set(audioElement, source)
  }

  const gain = ctx.createGain()
  const panner = ctx.createStereoPanner()
  gain.gain.value = volume
  panner.pan.value = pan
  source.connect(gain)
  gain.connect(panner)
  panner.connect(ctx.destination)

  nodes.set(slotId, { source, gain, panner, audio: audioElement })
  return { gain, panner }
}

export function setMixerVolume(slotId, volume) {
  const node = nodes.get(slotId)
  if (node) scheduleParam(node.gain.gain, volume)
}

export function setMixerPan(slotId, pan) {
  const node = nodes.get(slotId)
  if (node) scheduleParam(node.panner.pan, pan)
}

export function detachFromMixer(slotId) {
  const node = nodes.get(slotId)
  if (!node) return

  try {
    node.gain.disconnect()
    node.panner.disconnect()
  } catch {
    /* already disconnected */
  }

  nodes.delete(slotId)
}

export function resumeAudioContext() {
  return getAudioContext()
}
