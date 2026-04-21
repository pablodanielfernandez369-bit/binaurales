/**
 * Brown Noise Processor
 * Generates continuous brown noise by integrating white noise.
 * Eliminates loops and provides infinite variation.
 */
class BrownNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastOut = 0.0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];

    for (let i = 0; i < channel.length; i++) {
      // White noise base
      const white = Math.random() * 2 - 1;
      
      // Integration (Low Pass filter)
      // We use a small leak (1.02) to prevent the integrated value 
      // from drifting too far away from 0 (DC offset).
      const out = (this.lastOut + (0.02 * white)) / 1.02;
      
      // Amplification (Noise factor)
      channel[i] = out * 3.5;
      
      this.lastOut = out;
      
      // Copy to other channels if they exist
      for (let j = 1; j < output.length; j++) {
        output[j][i] = channel[i];
      }
    }

    return true; // Keep the processor alive
  }
}

registerProcessor('brown-noise-processor', BrownNoiseProcessor);
