import logging
import os
import azure.functions as func
from .. import config
import azure.cosmos as cosmos
import json
msg1={"result" : True, "msg": "OK" }
msg2={"result": False, "msg": "bad username or password" }
msg3={"result": False, "msg": "prompt id does not exist"}
msg4={"result": False, "msg": "access denied"}
query1= 'SELECT * FROM players p WHERE p.id=\"'
query2= 'SELECT * FROM prompts p WHERE p.id=\"'
query3= 'SELECT * FROM prompts p WHERE p.id=\"'
query4= 'DELETE FROM prompts p WHERE p.id=\"'

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


    prompt = req.get_json()
    idp = prompt['id']
    name = prompt['username']
    password = prompt['password']

    promptToDel= {}

    try:
        promptToDel = list(prompts_container.query_items(query=query3+idp+"\"",enable_cross_partition_query=True))[0]
        pass
    except:
        return(func.HttpResponse(body=json.dumps(msg3),status_code=200))
        pass
    try:
        logging.info("fetching player")
        splayer=list(players_container.query_items(query=query1+name+'\"',enable_cross_partition_query=True))[0]

        logging.info("player successfully found name= "+splayer['id']+" and password= "+splayer['password'])
        if splayer['password']==password:
            
                try:
                    
                    logging.info(promptToDel)
                    if promptToDel['username'] == name:
                        prompts_container.delete_item(promptToDel,partition_key=promptToDel['id']) #delete_item function is weird
                        return( func.HttpResponse(body=json.dumps(msg1),status_code=200))
                    
                    return(func.HttpResponse(body=json.dumps(msg4),status_code=200))
                    pass
                except:
                    logging.info("delete failed")
                    pass

        else:
            logging.info("player not found")
            return func.HttpResponse(body=json.dumps(msg2),status_code=200)
        pass
    except :
        return func.HttpResponse(body=json.dumps(msg2),
            status_code = 200)
        pass

    