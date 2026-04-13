.PHONY: run test test-unit test-int lint install docker-build docker-run

install:
	npm install

run: install
	node server/ws-server.js

test: install
	npm test

test-unit: install
	npm run test:unit

test-int: install
	npm run test:int

lint: install
	npm run lint

docker-build:
	docker build -t lan-pong .

docker-run:
	docker run --rm -p 3000:3000 lan-pong
