class BrownNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastOut = [0.0, 0.0]; // canal independiente por oído — ruido estéreo real
  }

  process(inputs, outputs) {
    const output = outputs[0];
    for (let ch = 0; ch < output.length; ch++) {
      const channel = output[ch];
      for (let i = 0; i < channel.length; i++) {
        const white = Math.random() * 2 - 1;
        this.lastOut[ch] = (this.lastOut[ch] + 0.02 * white) / 1.02;
        // Clamp para evitar distorsión por saturación
        channel[i] = Math.max(-1, Math.min(1, this.lastOut[ch] * 3.5));
      }
    }
    return true;
  }
}

registerProcessor('brown-noise-processor', BrownNoiseProcessor);
