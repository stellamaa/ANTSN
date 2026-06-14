let audioContext = null
const nodes = new Map()
const elementSources = new WeakMap()

export async function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
  return audioContext
}

export async function attachToMixer(slotId, audioElement, volume = 0.7) {
  const ctx = await getAudioContext()
  const existing = nodes.get(slotId)

  if (existing?.audio === audioElement) {
    existing.gain.gain.value = volume
    return existing.gain
  }

  detachFromMixer(slotId)

  let source = elementSources.get(audioElement)
  if (!source) {
    source = ctx.createMediaElementSource(audioElement)
    elementSources.set(audioElement, source)
  }

  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(ctx.destination)

  nodes.set(slotId, { source, gain, audio: audioElement })
  return gain
}

export function setMixerVolume(slotId, volume) {
  const node = nodes.get(slotId)
  if (node) node.gain.gain.value = volume
}

export function detachFromMixer(slotId) {
  const node = nodes.get(slotId)
  if (!node) return

  try {
    node.gain.disconnect()
  } catch {
    /* already disconnected */
  }

  nodes.delete(slotId)
}

export function resumeAudioContext() {
  return getAudioContext()
}
