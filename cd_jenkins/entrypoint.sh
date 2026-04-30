#!/bin/bash
# Remove SSH config that has wrong ownership (macOS volume mount preserves host UID)
# SSH refuses to read config files not owned by the running user
rm -f /var/jenkins_home/.ssh/config

# Pass SSH options via Ansible instead
export ANSIBLE_HOST_KEY_CHECKING=False
export ANSIBLE_SSH_ARGS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# Fix git safe directory
git config --global --add safe.directory '*'

exec /usr/local/bin/jenkins.sh "$@"
