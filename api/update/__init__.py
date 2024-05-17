import json
import logging
import azure.functions as func
import azure.cosmos as cosmos
from .. import config
import os

msg1 = {"result":True, "msg" : "OK"}
msg2 = {"result":False, "msg" : "wrong password"}
msg3 = {"result":False, "msg" : "Value to add is <=0"}
msg4 = {"result":False, "msg" : "user does not exist"}
query= 'SELECT * FROM players p WHERE p.id=\"'

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')
    
    uri = config.settings["db_URI"]
    key = config.settings["db_key"]
    idb = config.settings["db_id"]
    playersc = config.settings["players_container"]
    promptsc = config.settings["prompts_container"]

    client = cosmos.cosmos_client.CosmosClient(uri, key)
    db_client = client.get_database_client(idb)
    players_container = db_client.get_container_client(playersc)

    update = req.get_json()
    name = update['username']
    splayer={}
    try:
        logging.info("fetching player")
        splayer=list(players_container.query_items(query=query+name+'\"',enable_cross_partition_query=True))[0]
        pass
    except :
        return func.HttpResponse(body=json.dumps(msg4),
            status_code = 200)       
        pass

    if update['password'] == splayer['password']:
        logging.info("authentication complete")

    else:
        logging.info("password given is: "+update['password']+" password in db is: "+splayer['password'])
        return func.HttpResponse(body=json.dumps(msg2),
            status_code = 200) 
    addscore = 0
    addgame = 0
    score = True
    game = True
    try:
        addscore = update['add_to_score']
        pass
    except :
        score = False
        pass
    try:
        addgame = update['add_to_games_played']
        pass
    except :
        game = False
        pass

    if (game and addgame<=0) or (score and addscore<=0):
        return func.HttpResponse(body=json.dumps(msg3),status_code = 200)
    elif not game:
        splayer['total_score'] = splayer['total_score'] + update['add_to_score']
    elif not score:
        splayer['games_played'] = splayer['games_played'] + update['add_to_games_played']
        
    else:
        splayer['total_score'] = splayer['total_score'] + update['add_to_score']
        splayer['games_played'] = splayer['games_played'] + update['add_to_games_played']
    
    try:
        players_container.upsert_item(splayer)
        pass
    except:
        logging.info('error while upserting item')
        pass
    return func.HttpResponse(body=json.dumps(msg1),status_code=200)
