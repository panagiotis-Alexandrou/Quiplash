import logging
import os
from random import randint
import azure.functions as func
import azure.cosmos as cosmos
from .. import config
import json

query1= 'SELECT * FROM players p WHERE p.id=\"'
query2= 'SELECT * FROM prompts p WHERE p.username=\"'
query3= 'SELECT * FROM prompts p WHERE p.id=\"'

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

    uri = config.settings["db_URI"]
    key = config.settings["db_key"]
    idb = config.settings["db_id"]
    playersc = config.settings["players_container"]
    promptsc = config.settings["prompts_container"]


    client = cosmos.cosmos_client.CosmosClient(uri,key )
    logging.info("created client")

    db_client = client.get_database_client(idb)    
    logging.info("db client")

    players_container = db_client.get_container_client(playersc)
    logging.info("container")

    prompts_container = db_client.get_container_client(promptsc)


    promptG = req.get_json()

    promptTag = True
    player = True
    promptCount = 0
    players = list()
    try:
        promptCount = int(promptG['prompts'])
        pass
    except:
        promptTag = False
        pass
    try:
        players = list(dict.fromkeys(promptG['players']))
        pass
    except:
        player = False
        pass
    prompts = list()
    try:
        prompts = list(prompts_container.read_all_items())
        pass
    except:
        pass
    send = list()
    if promptTag:
        if promptCount >= len(prompts):
            for every in (prompts):
                item = {"id":every["id"],"username":every["username"],"text":every["text"]}
                send.append(item)
        elif promptCount >0:
            num = randint(0,len(prompts)-1)
            item = {"id":prompts[num]["id"],"username":prompts[num]["username"],"text":prompts[num]["text"]}
            send.append(item)
            for i in range(promptCount-1):             
                while (send.count(item)>0):
                    num = randint(0,len(prompts)-1)
                    item = {"id":prompts[num]["id"],"username":prompts[num]["username"],"text":prompts[num]["text"]}
                send.append(item)
        

    else:
        for user in players:
            try:
                texts = list(prompts_container.query_items(query=query2+user+"\"",enable_cross_partition_query=True))
                for text in texts:
                    item = {"id":text["id"],"username":text["username"],"text":text["text"]}
                    send.append(item)
                pass
            except:
                pass
    logging.info(send)
    return(func.HttpResponse(body=json.dumps(send),status_code=200))

   
