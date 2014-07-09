node-red-nodes-enocean-serial
=============================

Node-RED EnOcean In &amp; Out nodes

The nodes use the EnOcean serial protocol but only supports simple radio telegrams.
The nodes were tested using the EnOcean USB 300 Gateway on a Raspbery PI.

// Input <br/> 
The input supports the reception of radio telegrams only.
Switching, 1BS and 4byte telegrams

// Output <br/> 
The output node only sends switching telegrams and requies a baseID to be set.
This node should be considered work in progress as more work needs to done to use the baseID shipped the gateway.
