//import './styles/lumino.css';


import React, {Component} from 'react';
import ReactDOM from 'react-dom';

//import TableList from './components/tablelist.js'

//import {store} from './lib/store.js'

export default class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
          connected: false,
          output: ''
        };
    }  

  toggleCmd(arg) {
    if (this.state.connected) {
      if (arg === 1) {
        this.socket.send(this.avconvcmd.value)
      } else if (arg === 0) {
        this.socket.send('stop')
      }
    }
  }



  componentDidMount() {
    //this.player = new JSMpeg.Player('ws://'+ this.props.SERVER_URL + '/', {canvas: this.playercanvas});

    // initialise player (unless iphone, then use native <video> element
    if (!navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
      this.hls = new Hls();
      this.hls.loadSource('https://dashstore1.blob.core.windows.net/wcam/wcam/playlist.m3u8');
      this.hls.attachMedia(this.playervideo);
      this.hls.on(Hls.Events.MANIFEST_PARSED,function() {
          this.playervideo.play();
      });
    }


    var xhr  = new XMLHttpRequest(), that = this;
    xhr.open('GET', 'http://' + this.props.SERVER_URL + '/relayurls_' + this.props.SECRETURL);
    xhr.send();

    xhr.onload = function () {
      if (this.status == 200) {
        try {
          let { connect_url, sb_hc_token, error} = JSON.parse(this.response)
          if (error) {
            that.setState({connected : false,  output: that.state.output + `\nError getting connection strings: ${error}`})
          } else {
            that.setState({output: that.state.output + `\nSuccessfully Got connection strings`})
            // The "Sender" Role - client that initiates a new connection towards a listener 
            // cloud server, establishing connection to on-premises listener

            var socket = new WebSocket(connect_url + '&sb-hc-token=' + encodeURIComponent(sb_hc_token));
            socket.onopen = (event) => {
              that.socket = socket
              that.setState({connected: true, output: that.state.output + `\nSuccessfully established socket to Relay`})
            }
            socket.onclose = (event) => {
              that.setState({connected: false, output: that.state.output + `\nConnection closed: (${event.code}) ${event.reason}`})
            }
            socket.onmessage = (event) => {
              that.setState({output: that.state.output + '\n> ' + event.data}, () => {
                that.socketoutdom.scrollTop = that.socketoutdom.scrollHeight
              })
            }
          }
        } catch (e) {
          that.setState({output: that.state.output + '\n' + e})
        }

      } else {
        // Performs the function "reject" when this.status is different than 200
        that.setState({output: that.state.output + '\n' + this.response});
      }
    };
    xhr.onerror = function (e) {
      that.setState({output: that.state.output + '\nNetwork Error: ' + this.statusText})
    };
  }

  render() {
    return (
      <div className="container">
        <div className="row">
          <div className="col-xs-12 col-md-6">  
            <h1 className="page-header">Server URL [{this.props.SERVER_URL}]</h1>
            <p>start the stream <code class="well well-sm">
              <textarea
                rows="5"
                style={{"width": "100%"}}
                ref={(cmd) => { this.avconvcmd = cmd}}></textarea></code></p>
            <p>
                <button className="btn btn-lg" onClick={() => this.avconvcmd.value = `avconv -f v4l2  -thread_queue_size 1024 -framerate 29.97  -i /dev/video0 -f alsa -thread_queue_size 1024 -i plughw:CARD=HD3000,DEV=0  -preset slow -f mpegts -codec:v mpeg1video -codec:a mp2 http://${window.location.host}/video_${this.props.SECRETURL}`}>MPEG-TS (live)</button>
                <button className="btn  btn-lg" onClick={() => this.avconvcmd.value = `ffmpeg -f v4l2 -i /dev/video0 -f alsa  -thread_queue_size 1024 -i plughw:CARD=HD3000,DEV=0  -codec:v libx264 -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p  -codec:a aac -b:a 128k -strict experimental -f ssegment -segment_list http://${window.location.host}/wcam/hls/playlist.m3u8 -segment_list_flags +live -segment_time 5 http://${window.location.host}/wcam/hls/out%03d.ts`}>HLS</button>
                <button className="btn btn-success btn-lg" disabled={!this.state.connected} onClick={this.toggleCmd.bind(this, 1)}>start</button>
               
                <button className="btn btn-default btn-lg" disabled={!this.state.connected} onClick={this.toggleCmd.bind(this, 0)}>stop</button>
            </p>
            <figure className="highlight" style={{"height": "400px"}}>
                <pre style={{"height": "90%", "overflow-y": "scroll"}} ref={(con) => { this.socketoutdom = con}}>
                    <code className="language-html" >
                        {this.state.output}
                    </code>
                </pre><
            /figure>
          </div>
          <div className="col-xs-12 col-md-6">
            
              <canvas ref={(canvas) => { this.playercanvas = canvas}}></canvas>

              <video controls ref={(video) => { this.playervideo = video}}></video>
          </div>
        </div>
      </div>
    );
  }
}

/*
const ws = new WebSocket('ws://localhost:9090/path');

ws.addEventListener('open', (event) => {
  console.log ('open')
  ws.send('something');
});

ws.addEventListener('message', (event) => {
  console.log('dispatching message from server', event.data);
  store.dispatch(JSON.parse(event.data))
});
*/
ReactDOM.render(<App SECRETURL={SECRETURL} SERVER_URL={DEVURL || window.location.host}/>, document.getElementById('root'))
//const render = () => {
//  ReactDOM.render(<App store={store.getState()}/>, document.getElementById('root'));
//}
//store.subscribe(render)
//render()
