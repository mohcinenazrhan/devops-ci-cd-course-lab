FROM jenkins/jenkins:lts-jdk17
LABEL maintainer="Ernest Mueller <ernestmueller@theagileadmin.com>"

USER root

RUN \
    apt-get update && \
    apt-get install -y build-essential && \
    apt-get install -y golang-go && \
    apt-get install -y ansible && \
    apt-get install -y sshpass && \
    apt-get install -y nodejs npm && \
    apt-get install -y python3 python3-pip python3-venv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Robot Framework for UI tests (in a venv to avoid PEP 668 restrictions)
RUN python3 -m venv /opt/robot-venv && \
    /opt/robot-venv/bin/pip install --no-cache-dir \
        robotframework \
        robotframework-seleniumlibrary && \
    ln -s /opt/robot-venv/bin/robot /usr/local/bin/robot && \
    ln -s /opt/robot-venv/bin/rebot /usr/local/bin/rebot

USER jenkins

# Remove deprecated plugin bundled in the base image
RUN rm -f /usr/share/jenkins/ref/plugins/workflow-cps-global-lib.jpi

# Copy custom entrypoint that fixes SSH config ownership on startup
COPY --chown=jenkins:jenkins entrypoint.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
