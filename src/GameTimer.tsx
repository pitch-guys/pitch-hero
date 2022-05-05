import React from "react";
import { Component } from "react";

interface GameTimerProps {
  onTickCallback(delta: number): void,
  postTickCallback(delta: number): void
}

class GameTimer extends Component<GameTimerProps, {}> {

  frameID: number;
  lastFrameTime: number;

  constructor(props: any) {
    super(props);
    this.frameID = 0;
    this.lastFrameTime = 0;
  }

  requestFrame() {
    this.frameID = requestAnimationFrame((time: number) => this.onTick(time))
  }

  componentDidMount() {
    this.requestFrame();
  }
  
  componentWillUnmount() {
    if (this.frameID !== null)
      cancelAnimationFrame(this.frameID);
  }

  onTick(time: number) {
    let delta = (time - this.lastFrameTime) / 1000;

    this.props.onTickCallback(delta);
    this.props.postTickCallback(delta);

    this.lastFrameTime = time;
    this.requestFrame();
  }

  render() {
    return (
      <div id="gameTimer"></div>
    );
  }
}

export default GameTimer;
