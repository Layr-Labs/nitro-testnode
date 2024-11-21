FROM node:18-bullseye-slim


# Install necessary packages
RUN apt-get update && \
    apt-get install -y git docker.io python3 build-essential curl jq

# Create workspace
WORKDIR /workspace
# Clone the repository and checkout the specified branch
RUN git clone --no-checkout https://github.com/layr-labs/nitro-contracts.git ./
RUN git checkout a2de1c3ef227bde09b0b6ebfe272c66f441345f9
 
# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"
RUN foundryup

# Setup scripts and dependencies
RUN touch scripts/config.ts
RUN yarn install
RUN yarn build:all


ENTRYPOINT ["yarn"]
