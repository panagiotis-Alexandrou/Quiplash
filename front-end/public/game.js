var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        messages: [],
        
        chatmessage: '',
        username: '',
        password: '',
        prompt: '',
        answer:'',
        vote:'',
        display:{answers:new Array(),scores:new Array(),prompt:""},
        me: {name:'',password:'',state:false,prompt:'',answers:new Array(),scores:new Array(),admin: false},
        state: false,
        dstate:0,
        players: {},

    },
    mounted: function() {
        connect(); 
    },
    methods: {
        handleChat(message) {
            if(this.messages.length + 1 > 10) {
                this.messages.pop();
            }
            this.messages.unshift(message);
        },
        update(data){
            console.log(data);
            this.me = data.playerstate;
            this.state = data.state;
            this.players = data.players; 
            
        },
        chat() {
            socket.emit('chat',this.chatmessage);
            this.chatmessage = '';
        },
        register(){
            socket.emit('register',this.username,this.password);
            this.username = ''
            this.password = ''
        },
        login(){
            socket.emit('login',this.username,this.password);
            this.username = ''
            this.password = ''
        },
        sendPrompt(){
            socket.emit('prompt',this.prompt);
            this.prompt = ''
        },
        sendAnswer(){
            socket.emit('answer',this.answer);
            this.answer = ''
        },
        sendVote(vote){
            //this.vote = vote
            socket.emit('vote',vote);
            //this.vote=''
            //console.log(vote)
        },
        next(){
            socket.emit('next','advance');
        },
        upDisplay(data){
            console.log(data);
            this.display = data.display;
            this.dstate = data.state;
            this.players = data.players;
        },
        resetGame(){
            socket.emit('reset','reset')
        }

    }
});

function connect() {
    //Prepare web socket
    socket = io();

    //Connect
    socket.on('connect', function() {
        //Set connected state to true
        app.connected = true;
    });

    //Handle connection error
    socket.on('connect_error', function(message) {
        alert('Unable to connect: ' + message);
    });

    //Handle disconnection
    socket.on('disconnect', function() {
        alert('Disconnected');
        app.connected = false;
    });

    //Handle incoming chat message
    socket.on('chat', function(message) {
        app.handleChat(message);
    });

    socket.on('state', function(data) {
        app.update(data);
    });
    socket.on('unsuccessful login', function(data) {
        alert("login failed : "+data)
    });
    socket.on('unsuccessful register', function(data) {
        alert("register failed : "+data)
    });
    socket.on('display',function(data){
        app.upDisplay(data);
    })
}
