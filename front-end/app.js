'use strict';
const CLOUD_SERVER="https://quiplashpa1n20.azurewebsites.net/api"
//Set up express
const express = require('express');
const app = express();

//Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);
const axios = require('axios');
const { resolve } = require('path');
const { rejects } = require('assert');

//Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

//Handle client interface on /
app.get('/', (req, res) => {
  res.render('client');
});
//Handle display interface on /display
app.get('/display', (req, res) => {
  res.render('display');
});

let stateNum=1; //{1,2,3,4,5,6,7}
//let state = {state : 0}
let display={answers:new Array(),prompt:"",scores:new Array()};
let gamestart = false;
let activePrompts =  new Map();
let promptCounter = 0;
let roundPrompts = new Array();
let answers= new Array();
let votes=new Map();
let currentPrompt = "";
let roundNum = 1;
let roundScores = new Map();
let totalScores = new Map();
let playersToSockets = new  Map();
let socketsToPlayers = new  Map();
let audience = new Map();
let players = new Map();
let clients = new Array();
let prompts = new Map();

//Start the server
function startServer() {
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}
function clearArray(array){
  while(array.length>0){
    array.pop()
  }
}

function startGame(){
  console.log('Game starting');
  gamestart = true
  for (const [player,stats] of players){
    stats.state = 1
    totalScores.set(player,0);
  }
  

  //prepare players
  for(const [playerNumber,player] of players){
    player.state = 1;
  }
  startPrompts()
}

function endGame(){
  let scorez = translateScores(totalScores);
  scorez.sort(function(a, b) {
    return parseFloat(b.score) - parseFloat(a.score);
}); // sorts by score
  for( const [player,stats] of players){
    stats.scores = scorez;
  }
  for( const [player,stats] of audience){
    stats.scores = scorez;
  }
}

// prompts
function receivePrompt(socket,prompt){
prompts.set(socket,prompt);
const name = socketsToPlayers.get(socket);
if(players.has(name)){
  players.get(name).state=2;
}
else{
  audience.get(name).state=2;
}
updateAll()
}
//reset local game holders for next round
function startPrompts(){
  if (roundNum>1){
    promptCounter = 0;
  activePrompts.clear()
  clearArray(roundPrompts)
  clearArray(answers)
  votes.clear()
  currentPrompt = "";
  roundScores.clear()
  }
  console.log('starting prompts for '+players.size+ ' players')
  for(const [player,stats] of players){
    stats.state=1;
    stats.prompt = "";
    stats.answers = new Array();
    stats.scores = new Array();
  }
  for(const [player,stats] of audience){
    stats.state=1;
    stats.prompt = "";
    stats.answers = new Array();
    stats.scores = new Array();
  }

  updateAll();
}
function endPrompts(){
  for (let [socket,prompt] of prompts){
    createPrompt(socket,prompt);
  }
}


//answers

async function startAnswers(){
  let num = promptNum();
  let promptsToPlay = new Array();
  try {
     let incomingprompts= await getPrompt(Math.round(num/2));
     for (let i = 0; i<incomingprompts.length;i++){
      promptsToPlay.push(incomingprompts[i].text)
     }
  } catch (error) {
    
  }
  
  let localPrompts = getLocalPrompts(num-promptsToPlay.length,promptsToPlay);
  let roundProm = promptsToPlay.concat(localPrompts);
  roundPrompts = roundProm;
  setPromptsToPlayers(roundProm);
  
  for( const [player,stats] of players){
    stats.state = 1
    stats.prompt=activePrompts.get(player).pop();
  }
  for( const [player,stats] of audience){
    stats.state = 2
  }
  
  updateAll();

}
function endAnswers(){
  for(const i in answers){
    votes.set(answers[i].answer,new Array());
  }
}
function receiveAnswer(socket,answer){
  let name = socketsToPlayers.get(socket);
  answers.push({name:name,question:players.get(name).prompt,answer:answer});
  if (allAnswered(name)){
    players.get(name).state=2;
  }
  else{
    
    players.get(name).prompt=activePrompts.get(name).pop();
  }
  updateAll();
}
function allAnswered(name){
  
  return (activePrompts.get(name).length == 0)
}

//votes
function startVotes(){
  console.log('starting votes')
  for(const [player,stats] of players){
    stats.state=1;
  }
  for(const [player,stats] of audience){
    stats.state=1;
  }
  
  currentPrompt = roundPrompts[promptCounter];
  console.log('current prompt is : '+ currentPrompt)
  sendAnswers();
  updateAll();
  
}
function endVotes(){
  
  console.log("updating round scores")
  for(const i in answers){
    let cscore=0;
    if(roundScores.has(answers[i].name)){
      cscore = roundScores.get(answers[i].name);
    }
    console.log("round number is "+roundNum)
    let totl = cscore+(votes.get(answers[i].answer).length*100*roundNum)// possible bug on same answers
    console.log("player : "+answers[i].name+" has  "+votes.get(answers[i].answer).length + "votes on this "+answers[i].answer)
    roundScores.set(answers[i].name,totl);
  }
}

function translateScores(scores){
  let returningscores = new Array();
  for (const [player,score] of scores){
    returningscores.push({player:player,score:score})
  }
  return returningscores;
}
function receiveVote(socket,vote){
  let name = socketsToPlayers.get(socket);
  votes.get(vote).push(name);
  if(players.has(name)){
    players.get(name).state=2;
  }
  else{
    audience.get(name).state=2;
  }
  
  updateAll();
  console.log("promptcounter is "+promptCounter+" and prompts for this round is "+roundPrompts.length)
  if(votingFinished()){
    console.log("voting is finished")
    if( promptCounter<roundPrompts.length){
      
      startVotes();
    }
    else{
      showRoundScores();
    }

    
  }

}
function votingFinished(){
  for(const [player,stats] of players){
    if (stats.state == 1){
      return false;
    }
  }
  return true;
}
function sendAnswers(){
  promptCounter++;
  let answeredprompts = new Array();
  let forbiddenPlayers = new Array();
  for (const i in answers){
    if(answers[i].question == currentPrompt){
      forbiddenPlayers.push(answers[i].name);
      answeredprompts.push(answers[i].answer);
    }
  }
  for(const [player,stats] of players){
    if(!forbiddenPlayers.includes(player)){
      //
      stats.answers = answeredprompts;
      stats.prompt = currentPrompt;
    }
  }
  for(const [player,stats] of audience){
      stats.answers = answeredprompts;
      stats.prompt = currentPrompt;
  }
  display.answers = answeredprompts;
  display.prompt = currentPrompt;
  for (let i in forbiddenPlayers){
    players.get(forbiddenPlayers[i]).state = 2;
  }
}
//results
//function startResults(){}
//function endResults(){}

//scores
function showRoundScores(){
  let scorez = translateScores(roundScores)
  for( const [player,stats] of players){
    stats.scores = scorez
  }
  for( const [player,stats] of audience){
    stats.scores = scorez
  }
  display.scores = scorez
}
function endroundScores(){
  
  for(const [player,score] of roundScores){
    let total = totalScores.get(player);
    totalScores.set(player,total+score);
  }
}

function showtotalScores(){
  for( const [player,stats] of players){
    stats.scores = translateScores(totalScores);
  }
  for( const [player,stats] of audience){
    stats.scores = translateScores(totalScores);
  }
  display.scores = translateScores(totalScores)
}
function endTotalScores(){
  roundNum++;
  if(roundNum > 3){
    advance();
  }
  else{
    stateNum = 2;
    startPrompts();
  }
}
function resetGame(){
  stateNum = 0
  for (const [player,stats] of players){
    stats.admin = false;
  }
  updateAll()
  stateNum = 1
  roundNum = 1
  promptCounter = 0;
  activePrompts.clear()
  clearArray(roundPrompts)
  clearArray(answers)
  votes.clear()
  currentPrompt = "";
  roundScores.clear()
  players.clear()
  audience.clear()
  playersToSockets.clear()
 socketsToPlayers.clear()
 prompts.clear()
 gamestart = false;
 totalScores.clear()
}
//called when next is clicked
 function advance(){
  if (stateNum==7){
    return;
  }
  stateNum++;
  if(stateNum==2)
    startGame()
  else if(stateNum==3){
    endPrompts();
    startAnswers();
  }
  else if(stateNum==4){
    endAnswers();
    startVotes();
  }
  else if(stateNum==5){
    endVotes();
    showRoundScores();// round vote results here
  }
  else if(stateNum==6){
    endroundScores();
    showtotalScores();
  }
  else if(stateNum==7){
    endTotalScores();
    endGame();
  }

}
function setPromptsToPlayers(totalPrompts){
    let counter = 0;
    let playernames = Array.from(players.keys());
    for(let i in totalPrompts){
      addPrompt(playernames[counter],totalPrompts[i]);
      counter=increasePlayerCounter(counter);
      addPrompt(playernames[counter],totalPrompts[i]);
      counter=increasePlayerCounter(counter);
    }
  
}

function increasePlayerCounter(n){
  n++;
  if (n==players.size){
    n=0;
  }
  return n;
}

function addPrompt(name,prompt){
  console.log('adding prompt: '+prompt + ' in active')
  if(activePrompts.has(name)){
    activePrompts.get(name).push(prompt);
  }
  else{
    const promArr = new Array();
    promArr.push(prompt);
    activePrompts.set(name,promArr);
  }
}



function updateAll(){
  console.log('Updating players');
  for(let [playerName,socket] of playersToSockets){
    if(players.has(playerName)){
    updatePlayer(socket);
    }
    else{
    updateAud(socket);
  }
}
updateDisplays()
}

//update one player
function updatePlayer(socket) {
  const playerName = socketsToPlayers.get(socket);
  const data = {state: stateNum,playerstate:players.get(playerName),players:Array.from(players.keys())};
  // can see what needs to be sent to client (audience length too)
  try {
    socket.emit('state',data);
  } catch (error) {
    console.log(error)
  }
}
function updateAud(socket) {
  const playerName = socketsToPlayers.get(socket);
  const data = {state: stateNum,playerstate:audience.get(playerName),players:Array.from(players.keys())};
  // can see what needs to be sent to client
  socket.emit('state',data);
}
function updateDisplays(){
  console.log("updating display")
  const data = {state:stateNum,display:display,players:Array.from(players.keys())}
  for(const socket of clients){
    if(!socketsToPlayers.has(socket)){
      socket.emit('display',data)
    }
  }
}

//Chat message
function handleChat(message,socket) {
    console.log('Handling chat: ' + message); 
    let username = socketsToPlayers.get(socket);
    io.emit('chat',username+": "+message);
}
function handleJoin(socket,username) {
  console.log('adding '+username+" in the logz");
  socketsToPlayers.set(socket,username);
  playersToSockets.set(username,socket);
}
function handleRegister(username,password,socket) {
  console.log('Handling register with username: ' +username); 
  register(username,password,socket)
}
function handleLogin(username,password,socket) {
  console.log('Handling login with username : ' + username); 
  // deduce username and password and pass to function
  login(username,password,socket);
}
function handlePrompt(socket,prompt) {
  let username = socketsToPlayers.get(socket)
  console.log('Handling prompt: ' + prompt + " from user :"+ username); 
  receivePrompt(socket,prompt);
}
function handleAnswer(socket,message) {
  let name = socketsToPlayers.get(socket)
  console.log('Handling answer: ' + message + " from "+name); 
  receiveAnswer(socket,message);
}
function handleVote(socket,message) {
  console.log('Handling vote: ' + message); 
  receiveVote(socket,message);
}
function handleNext() {
  console.log('Handling next action'); 
  advance();
  updateAll();
}
function HandleError(socket, message, halt){
  console.log('Error: '+message);
  socket.emit('fail',message);
  if(halt){
    socket.disconnect();
  }
}
//handling announcements
function announce(message){
  console.log('Announcement: '+message);
  io.emit('chat',message);
}

function login(username,password,socket){
  axios.post(CLOUD_SERVER + "/player/login",
    {
        username: String(username),
        password: String(password)
    },
    {

        headers: { "x-functions-key": APP_KEY }

    }).then((out) => {
        console.log(out.data.result);
        if (out.data.result) {
          handleJoin(socket,username);
    
            //ADD TO IF AUDIENCE MEMBER OR IF PLAYER
          playerCheck(username,password);
          updateAll();
    
        } else {
            socket.emit("unsuccessful login",out.data.msg);

        }

    }).catch(function (error) {
        if (error.response) {
          console.log(error.response)
            return error.response;
        }
    });
}
function createPrompt(socket,prompt){
  console.log("creating prompt")
  let username = socketsToPlayers.get(socket);
  let password ;
  if (players.has(username)){
    password = players.get(username).password
  }
  else{
    password = audience.get(username).password
  }

  axios.post(CLOUD_SERVER+"/prompt/create",{
    username: username,
    password: password,
    text: prompt
  },
  {

      headers: { "x-functions-key": APP_KEY }

  }).then((out) => {
      console.log(out.data);
      return;
  }).catch(function (error) {
      if (error.response) {
        console.log("error while creating prompt in api")
          return error.response;
      }
  });
}
 function  getPrompt(number){
  return new Promise(function(resolve,reject) {
    axios.post(CLOUD_SERVER+"/prompts/get",{
      prompts: number
    },
    {
  
        headers: { "x-functions-key": APP_KEY }
  
    }).then((out) => {
  

      console.log(out.data)
      resolve(out.data);
  
    }).catch(function (error) {
        if (error.response) {
          console.log(error.response)
            reject(error.response);
        }
    });
  })

}

function register(username,password,socket){
  axios.post(CLOUD_SERVER + "/player/register",
    {
        username: String(username),
        password: String(password)
    },
    {

        headers: { "x-functions-key": APP_KEY }

    }).then((out) => {
        console.log(out.data.result);
      
        if (out.data.result) {
            handleJoin(socket, username);
            playerCheck(username,password);
            updateAll();
        } else {
            
            socket.emit("unsuccessful register",out.data.msg);

        }

    }).catch(function (error) {
        if (error.response) {

            return error.response;
        }
    });
}


//Handle new connection
io.on('connection', socket => { 
  console.log('New connection');
  clients.push(socket);
  //updateDisplays()
  //Handle on chat message received
  socket.on('chat', message => {
    handleChat(message,socket);
  });

  //Handle disconnection
  socket.on('disconnect', () => {
    clients.splice(clients.indexOf(socket)); // !!!!!
    console.log('Dropped connection');
    updateAll();
    // remove player or audience
  });
  // might need to make data string for cleansing
  socket.on('register',(username,password) =>{
    console.log("registering user");
    handleRegister(username,password,socket);
    //updateAll();
  });
  socket.on('login',(username,password) =>{
    console.log("logging user in");
    handleLogin(username,password,socket);
  });
  socket.on('prompt',data =>{
    console.log("prompts");
    handlePrompt(socket,data);
    //updateAll();
  });
  socket.on('answer',data =>{
    console.log("received answer");
    handleAnswer(socket,data);
    updateAll();
  });
  socket.on('vote',data =>{
    //console.log("vote sent in");
    handleVote(socket,data);
    //updateAll();
  });
  socket.on('next',data =>{
    console.log("advancing to next stage");
    handleNext();
    //updateAll();
  });
  socket.on('reset',data =>{
    console.log("reseting game");
    resetGame()
    //updateAll();
  });
  
  
});

function playerCheck (username,password){
  if (!players.has(username) || !audience.has(username)){
    if(players.size==0){
    players.set(username,{name:username,password:password,state:1,prompt:"",admin:true,answers:new Array(),scores:new Array()}); //state is 0 because of successful login -1 disconected 0 waiting 1 action needed 2 action received
      console.log('added admin in players ' + username); 
  }
  else if(players.size<8 && !gamestart){
      players.set(username,{name:username,password:password,state:1,prompt:"",admin:false,answers:new Array(),scores:new Array()}); //state is 0 because of successful login -1 disconected 0 waiting 1 action needed 2 action received
      console.log('added player in players ' + username);    
    } 
    else {
      if (stateNum !=3){
        audience.set(username,{name:username,password:password,state:1,prompt:"",answers:new Array(),scores:new Array()})
    }else { 
      audience.set(username,{name:username,password:password,state:2,prompt:"",answers:new Array(),scores:new Array()})
      
    }
       console.log('added player in audience ' + username); 
    }}
    else{
      updateAll();
    }
}

function promptNum(){
  let total = 0;
  if (players.size %2 == 0){ total = players.size/2}
  else 
  total = players.size;
  return total;
}

function getLocalPrompts(number,prom){
  let i = number;
  let promTo = new Array();
  
  while (i>0 ){
   let bum = Math.floor(Math.random() * prompts.size);
   let sockets = Array.from(prompts.keys())
    if (!promTo.includes(prompts.get(sockets[bum])) && !prom.includes(prompts.get(sockets[bum]))){
      i--;
      promTo.push(prompts.get(sockets[bum]));
    }
  }
  return promTo;
}




//Start server
if (module === require.main) {
  startServer();
}

module.exports = server;
