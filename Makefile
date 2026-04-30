.PHONY: dev up down restart logs ps clean jenkins-fix

# Start the full environment (build images + start containers)
dev: up jenkins-fix
	@echo ""
	@echo "Environment ready!"
	@echo "  Jenkins: http://localhost:8080  (admin/theagileadmin)"
	@echo "  Nexus:   http://localhost:8081  (admin/theagileadmin)"
	@echo "  SSH:     ssh -p 2222 root@localhost (theagileadmin)"
	@echo ""

# Build and start all containers
up:
	docker-compose up --build -d

# Apply post-start fixes (git safe directory)
jenkins-fix:
	@echo "Waiting for Jenkins to start..."
	@until curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/login | grep -q 200; do sleep 2; done
	docker exec courseenvironments-jenkins-1 git config --global --add safe.directory '*'
	@echo "Jenkins ready."

# Stop all containers
down:
	docker-compose down

# Stop and remove everything (images, volumes)
clean:
	docker-compose down -v --rmi all --remove-orphans

# Restart a specific service (usage: make restart s=jenkins)
restart:
	docker-compose restart $(s)

# View logs (usage: make logs s=jenkins)
logs:
	docker-compose logs --tail=50 -f $(s)

# Show container status
ps:
	docker-compose ps
