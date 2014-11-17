node-red-enocean-serial-in-out
==============================

Node-RED EnOcean In &amp; Out nodes

The nodes use the EnOcean serial protocol but only supports simple radio telegrams.
The nodes were tested using the EnOcean USB 300 Gateway on a Raspbery PI.

// Input <br/> 
The input supports the reception of radio telegrams only.
Switching, 1BS and 4byte telegrams

<pre>
//Serial in settings
Serial Port: /dev/ttyUSB0
Baud Rate: 57600 
Data Bits: 8
Parity: None
Stop Bits: 1
Split input: after fixed timeout of: 50ms
and deliver: binary buffers

// msg object
msg.payload // EnOcean device/chip ID 

// Switching telegram 	
msg.ID	   // EnOcean device/chip ID 
msg.state  // Rocker state 1 for [I] top pressed, 
           //              O for [O] bottom pressed
           //             -1 for released 
msg.rocker // |A|B| if single gang then A is sent
msg.rssi   // revived signal strength dBm e.g. -

// 1BS sensor telegram 	
msg.ID	   // EnOcean device/chip ID 
msg.state  // 8 open  or 0
           // 9 close or 1
msg.rssi   // revived signal strength dBm e.g. -


// 4BS telegram 	
msg.ID 	   // EnOcean device/chip ID  
msg.DBall  // All data bytes as an array 
msg.DB1    // Data byte 1
msg.DB2    // Data byte 2
msg.DB3    // Data byte 3
msg.DB4    // Data byte 4
msg.rssi   // revived signal strength dBm e.g. -
</pre>

// Output <br/> 
The output node only sends switching telegrams and requies a baseID to be set.
This node should be considered work in progress as more work needs to done to use the baseID shipped the gateway.
