import json
import logging
import os

import azure.functions as func
import azure.cosmos as cosmos
from .. import config
def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('processing leaderboard on the cloud')


    uri = config.settings["db_URI"]
    key = config.settings["db_key"]
    idb = config.settings["db_id"]
    playersc = config.settings["players_container"]
    promptsc = config.settings["prompts_container"]

    client = cosmos.cosmos_client.CosmosClient(uri, key)
    db_client = client.get_database_client(idb)
    players_container = db_client.get_container_client(playersc)

    lead = req.get_json()

    top = int(lead['top'])

    players = list()
    try:
        players = list(players_container.read_all_items())
        pass
    except:
        pass
    topk = list()
    if(len(players)==0):
        return(func.HttpResponse(body=json.dumps(players)))
    newlist = sorted(players, key=lambda d: d['id'])
    finalList = sorted(newlist, key=lambda d: d['total_score'],reverse=True)
    if top >= len(finalList):
        for i in range(len(finalList)):
            topk.append({'username':finalList[i]['id'],'score':finalList[i]['total_score'],"games_played":finalList[i]['games_played']})
        logging.info(topk)
        return(func.HttpResponse(body=json.dumps(topk),status_code=200))
    for i in range(top):
        topk.append({'username':finalList[i]['id'],'score':finalList[i]['total_score'],"games_played":finalList[i]['games_played']})
    logging.info(topk)
    return(func.HttpResponse(body=json.dumps(topk),status_code=200))