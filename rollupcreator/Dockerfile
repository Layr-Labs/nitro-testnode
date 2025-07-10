FROM node:20-bookworm-slim
RUN apt-get update && \
    apt-get install -y git docker.io python3 make gcc g++ curl jq
ARG NITRO_CONTRACTS_BRANCH=eigenda-v2.1.3
WORKDIR /workspace  
RUN git clone --no-checkout https://github.com/layr-labs/nitro-contracts.git ./
RUN git checkout eigenda-v2.1.3
RUN yarn install && yarn cache clean
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup --install 1.0.0
RUN touch scripts/config.ts
RUN yarn build:all
ENTRYPOINT ["yarn"]
