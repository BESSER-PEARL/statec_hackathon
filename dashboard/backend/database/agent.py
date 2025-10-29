# You may need to add your working directory to the Python path. To do so, uncomment the following lines of code
# import sys
# sys.path.append("/Path/to/directory/agentic-framework") # Replace with your directory path

import json
import logging

from besser.agent.core.agent import Agent
from besser.agent.core.session import Session
from besser.agent.exceptions.logger import logger

from besser.agent.nlp.llm.llm_openai_api import LLMOpenAI
from observationchecker import fetch_all_datatables, get_datatable_id_by_name, get_dimensions_by_datatable_id, get_dimension_ids_by_names, get_observation_values, get_observation_ids_by_dimension

# Configure the logging module (optional
logger.setLevel(logging.INFO)

# Create the agent
agent = Agent('greetings_agent')
# Load agent properties stored in a dedicated file
agent.load_properties('config.ini')
# Define the platform your agent will use
websocket_platform = agent.use_websocket_platform(use_ui=False)

# STATES
gpt = LLMOpenAI(agent=agent, name='gpt-4o-mini', parameters={})


initial_state = agent.new_state('initial_state', initial=True)


base_state = agent.new_state('base_state')

question_state = agent.new_state('question_state')

# INTENTS

hello_intent = agent.new_intent('hello_intent', [
    'hello',
    'hi',
])

good_intent = agent.new_intent('good_intent', [
    'good',
    'fine',
])

bad_intent = agent.new_intent('bad_intent', [
    'bad',
    'awful',
])


# STATES BODIES' DEFINITION + TRANSITIONS




def init_body(session: Session):
    session.reply('Hi!  I am lux data bot linked to LUSTAT. I am an expert in the data related to the age of the citizen. Ask any question and I will try to provide you insights.')

def base_body(session: Session):
    session.reply('Ask any question and I will try to provide you insights.')

initial_state.set_body(init_body)

base_state.set_body(base_body)


def question_body(session: Session):
    datatable = fetch_all_datatables()
    message = session.event.message
    prompt = f"Given the user's request: '{message}', which datatable fits the most? Decide using this description of the databases and only answer with the name of the database: \n{datatable}"
    request1 = gpt.predict(prompt)
    print(request1)

    id = get_datatable_id_by_name(request1)
    

    
    dimensions = get_dimensions_by_datatable_id(id)
    print(dimensions)
    prompt2 = f"Given the user's request: '{message}', and the following dimensions: {dimensions}, return the dimension that could be relevant to the user's query. Answer only with the name of the most fitting dimension."
    request2 = gpt.predict(prompt2)
    print(request2)
    print(prompt2)
    response = {"dataset_name": request1, "dimension_name": request2, "message": f"I selected the most fitting dataset and dimension for your request: {request1}"}
    session.reply(json.dumps(response))
    #print(dimensions)
    
    #category = get_categories_by_datatable_id(id)
    #session.reply(category)
        #request2 = gpt.predict(prompt2)
    #print(request2)
    

    #parsed_dimensions = json.loads(request2)

    #selected_dimension_id = parsed_dimensions.get("id")


    #observations = get_observation_ids_by_dimension(id, selected_dimension_id)
    #observation_values = get_values_by_observation_ids(observations)
    #session.reply(observation_values)
    #prompt3 = f"Based on the user's request: '{message}', the datatable ID: {id}, and the selected dimensions: {dimensions}, generate an SQL query to fetch the relevant observation values. Ensure the query is valid and optimized."
    #sql_query = gpt.predict(prompt3)
    #print(sql_query)
    #session.reply(sql_query)
    

question_state.set_body(question_body)

initial_state.when_no_intent_matched().go_to(question_state)

base_state.when_no_intent_matched().go_to(question_state)

question_state.go_to(base_state)
# RUN APPLICATION

if __name__ == '__main__':
    agent.run()