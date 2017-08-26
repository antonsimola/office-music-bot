import React, {Component} from 'react';
import './App.css';
import ReactPlayer from 'react-player';
import api from './api.js';

class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
            currentYoutubeUrl: "https://www.youtube.com/watch?v=ArWQWAUoiSU",
            playing: false,
            volume: 1.0
        };
        api.subscribePlayerStatus(data => this.setState({playing: data}));
        api.subscribeVolume(data => this.setState({volume: data}));
        api.subscribeNextEvent(data => this.setState({currentYoutubeUrl: data}));
    }

    render() {
        return (
            <ReactPlayer
                url={this.state.currentYoutubeUrl}
                playing={this.state.playing}
                youtubeConfig={{preload: true}}
                volume={this.state.volume}
                onEnded={() => api.emitGetNext()}
            />
        );
    }
}


export default App;
