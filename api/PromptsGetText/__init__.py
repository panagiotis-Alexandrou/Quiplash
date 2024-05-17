import logging
import os
import azure.functions as func
import azure.cosmos as cosmos
import json
from .. import config

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


    promptReq = req.get_json()

    exact = bool(promptReq['exact'])
    word = str(promptReq['word'])

    prompts = list(prompts_container.read_all_items())
    send = list()

    for text in prompts:
        item = {"id":text["id"],"username":text["username"],"text":text["text"]}
        promptOnSearch = str(text["text"])
        if not exact :
            word = word.lower()
            promptOnSearch = promptOnSearch.lower()

        #search the prompts for the specified word
        if search(word=word,prompt=promptOnSearch):
            send.append(item)
            
   
    logging.info(send)
    return(func.HttpResponse(body=json.dumps(send),status_code=200))

   
def search(prompt:str,word:str):
    puncts = [" ",".",",","!",";",":","?"]
    sum = 0
    for a in puncts:
        sum+= int(prompt.startswith(word+a))
        sum+= int(prompt.endswith(a+word))
        for b in puncts:
            sum += prompt.count(a+word+b)
    if sum>0:
        return True
    else:
        return False