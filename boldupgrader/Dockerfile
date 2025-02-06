FROM node:18-bullseye-slim
RUN apt-get update && \
    apt-get install -y git docker.io python3 make gcc g++ curl jq
ARG BOLD_CONTRACTS_BRANCH=bold-merge-script
WORKDIR /workspace  


RUN git clone https://github.com/Layr-Labs/nitro-contracts.git .
RUN git checkout 5076da80831eab20e0b2dea22554a16c7dfc6452

RUN yarn install && yarn cache clean
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup
RUN touch scripts/config.ts
RUN yarn build:all
ENTRYPOINT ["yarn"]
