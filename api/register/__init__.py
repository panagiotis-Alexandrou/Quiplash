import json
import logging
import azure.functions as func
import azure.cosmos as cosmos

from .. import config
import os


msg1 = {"result":True, "msg" : "OK"}
msg2 = {"result":False, "msg" : "Username already exists"}
msg3 = {"result":False, "msg" : "Username less than 4 characters or more than 16 characters"}
msg4 = {"result":False, "msg" : "Password less than 8 characters or more than 24 characters"}


def main(req: func.HttpRequest) -> func.HttpResponse:

    logging.info('registering Identity in the Cloud')

    uri = config.settings["db_URI"]
    key = config.settings["db_key"]
    idb = config.settings["db_id"]
    playersc = config.settings["players_container"]
    promptsc = config.settings["prompts_container"]
    

    client = cosmos.cosmos_client.CosmosClient(uri, key)


    db_client = client.get_database_client(idb)


    players_container = db_client.get_container_client(playersc)

    credentials = req.get_json()


    name = credentials['username']
    password = credentials['password']

    result = ""
    if len(name) <4 or len(name) >16 :
        result = msg3
    elif len(password) > 24 or len(password) < 8 :
        result = msg4
    
    if result != "":
        return func.HttpResponse(body=json.dumps(result),
            status_code = 200)
    try:

        players_container.create_item({'id':name, 'password':password, 'games_played':0,'total_score':0})
        return func.HttpResponse(body=json.dumps(msg1),
            status_code = 200)
        pass
    except :
        return func.HttpResponse(body=json.dumps(msg2),
            status_code = 200)
        pass
