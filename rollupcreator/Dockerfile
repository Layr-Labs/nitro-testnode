FROM node:18-bullseye-slim
RUN apt-get update && \
    apt-get install -y git docker.io python3 make gcc g++ curl jq
ARG NITRO_CONTRACTS_BRANCH=main
WORKDIR /workspace  
RUN git clone --no-checkout https://github.com/Layr-Labs/nitro-contracts.git ./
RUN git checkout 85aa27d11776bcbadf7f09aebdf71562bcb76e51
RUN yarn install && yarn cache clean
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup --install 1.0.0

# Setup scripts and dependencies
RUN touch scripts/config.ts
RUN yarn build:all


ENTRYPOINT ["yarn"]
