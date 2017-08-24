import React, {Component} from 'react';
import './App.css';
import ReactPlayer from 'react-player';
import Websocket from 'react-websocket';

class App extends Component {


    constructor(props) {
        super(props);
        this.state = {
            currentYoutubeUrl: "https://www.youtube.com/watch?v=d46Azg3Pm4c",
            playing: false
        }
    }

    handlePlayerStatus(result) {
        console.log(result);
        this.setState({playing: result.playing}, () => console.log("state changed"));
    }

    render() {
        return (
            <div>
                <ReactPlayer
                    url={this.state.currentYoutubeUrl}
                    playing={this.state.playing}
                    youtubeConfig={{preload:true}}
                />
                <button onClick={() => this.setState({playing: true}, () => console.log('state changed'))}></button>
                <Websocket
                    url='ws://localhost:3001/'
                    onMessage={this.handlePlayerStatus.bind(this)}
                />
            </div>
        );
    }
}


export default App;
