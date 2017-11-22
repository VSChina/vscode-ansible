FROM ansible/ansible:ubuntu1604
MAINTAINER zikalino

# run apt-get update for later purposes
RUN apt-get update

# clone actual ansible directory as it's not a part of base ansible/ansible
# setup all necessary dependencies
RUN git clone https://github.com/zikalino/ansible.git --recursive
RUN pip install -r /ansible/requirements.txt
RUN pip install -r /ansible/packaging/requirements/requirements-azure.txt 
RUN pip install azure-mgmt-containerinstance
RUN pip install pycodestyle pylint voluptuous pytest
RUN pip install docker-py
RUN cd /ansible && /bin/bash -c "source ./hacking/env-setup"
ENV PATH="/ansible/bin:/ansible/test/runner:${PATH}"
ENV PYTHONPATH="/ansible/lib:${PYHONPATH}"
ENV MANPATH="/ansible/docs/man:${MANPATH}"

# install sshpass -- useful when connecting via ssh using username & password
RUN apt-get -y install sshpass

RUN curl -fsSL get.docker.com -o get-docker.sh
RUN sh get-docker.sh

# install Azure CLI
#RUN apt-get install -y python libssl-dev libffi-dev python-dev build-essential 
COPY install.py ./install.py 
RUN python ./install.py
RUN cp /root/bin/az /usr/bin 
