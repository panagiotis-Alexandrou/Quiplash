import json
import logging
from .. import config
import azure.functions as func
import azure.cosmos as cosmos

import os

msg1 = {"result":True, "msg" : "OK"}
msg2 = {"result":False, "msg" : "Username or password incorrect"}
query= 'SELECT * FROM players p WHERE p.id=\"'
def main(req: func.HttpRequest) -> func.HttpResponse:

    uri = config.settings["db_URI"]
    key = config.settings["db_key"]
    idb = config.settings["db_id"]
    playersc = config.settings["players_container"]
    promptsc = config.settings["prompts_container"]

    logging.info('Verifying Identity in the Cloud')

    client = cosmos.cosmos_client.CosmosClient(uri,key )
    logging.info("created client")

    db_client = client.get_database_client(idb)    
    logging.info("db client")

    players_container = db_client.get_container_client(playersc)
    logging.info("container")

    credentials = req.get_json()

    name = credentials['username']
    password = credentials['password']

    try:
        logging.info("fetching player")
        splayer=list(players_container.query_items(query=query+name+'\"',enable_cross_partition_query=True))[0]

        logging.info("player successfully found name= "+splayer['id']+" and password= "+splayer['password'])
        if splayer['password']==password:
            return func.HttpResponse(body=json.dumps(msg1),
            status_code = 200)
        else:
            logging.info("player not found")
            return func.HttpResponse(body=json.dumps(msg2),status_code=200)
        pass
    except :
        return func.HttpResponse(body=json.dumps(msg2),
            status_code = 200)
        pass
