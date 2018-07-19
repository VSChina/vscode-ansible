FROM ansible/ansible:ubuntu1604
MAINTAINER yungez@microsoft.com

# install ansible
RUN apt-get update  && \
    apt-get install -y software-properties-common  && \
    apt-add-repository ppa:ansible/ansible  && \
    apt-get update  && \
    echo Y | apt-get install -y ansible

RUN apt-get install -y sshpass openssh-client

RUN pip install --upgrade pip

# install Azure, aws, gce, Rackspace, CloudStack dependencies
RUN pip install ansible[azure] \
    boto \
    apache-libcloud \
    pyrax \
    cs

# clean
RUN apt-get clean

CMD ["ansible", "--version"]
