class AudioContext{
  audioCtx
  analyser
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
  }
  getAudioContext() {
    return this.audioCtx;
  }

  getAnalyser() {
    return this.analyser;
  }

  resetAnalyser() {
    this.analyser = this.audioCtx.createAnalyser();
  }

  decodeAudioData(audioData: any) {
    this.audioCtx.decodeAudioData(audioData).then(function (decodedData) {
      // use the decoded data here
    });
  }
};

export default AudioContext;