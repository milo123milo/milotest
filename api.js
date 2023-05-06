const willhaben = require('willhaben')
const bot = require('./bot')
const phone = require('./phone')
const axios = require('axios');


const JSONdb = require('simple-json-db');

const main = new JSONdb('./database/main.json');
const temp = new JSONdb('./database/temp.json');
const newad = new JSONdb('./database/new.json');

var db = new JSONdb('./database/misc.json');

var misc = db.get('misc');

const httpsProxyAgent = require('https-proxy-agent');


const proxy = 'http://wnybjgaa-rotate:uoh1cfnoj46q@p.webshare.io:80/';
const agent = new httpsProxyAgent(proxy);

const dataReceived = []; // Array to store the data received from the API
let dataSent = []; 
let messageQueue = [];
let lastSentTime = 0;
let sendInterval = 1000; 

function sendMessage(message) {
  let currentTime = new Date().getTime();
  messageQueue.push({ message: message, time: currentTime });
}

function sendQueuedMessages() {
  let currentTime = new Date().getTime();

  while (messageQueue.length > 0 && currentTime - messageQueue[0].time >= sendInterval) {
    let message = messageQueue.shift().message;
    console.log(`Sending message: ${message}`);
    bot.send(message);
    lastSentTime = currentTime;
  }
}
/*
async function getphone(id) {
  
  try {
    const response = await axios.get('http://127.0.0.1:5000/' + id);
    console.log("Response data:" + response.data)
    return response.data;
  } catch (error) {
    console.error(error);
    return "**?"
  }
}*/
async function getPhone(url) {
  const MAX_ATTEMPTS = 100;
  const PARALLEL_REQUESTS = 10;

  const promises = Array.from({ length: PARALLEL_REQUESTS }, () =>
    axios.get('https://www.willhaben.at/iad/' + url, { httpsAgent: agent })
      .then((response) => {
        if (response.status === 200) {
          const temp = response.data.substr(response.data.indexOf('<script id="__NEXT_DATA__" type="application/json">') + '<script id="__NEXT_DATA__" type="application/json">'.length);
          const result = JSON.parse(temp.substr(0, temp.indexOf('</script>')));
          const res = result.props.pageProps.advertDetails.advertContactDetails.contactDetail.find(attr => attr.id === "phoneNo")?.contactDetailField[0].value;
          if (res === undefined) {
            console.log("Response from proxy was empty, retrying...")
            throw new Error("Empty response");
          } else {
            return res;
          }
        } else {
          console.log("Bad response status from proxy, retrying...")
          throw new Error("Bad response status");
        }
      })
      .catch((error) => console.error(error))
  );

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const res = await Promise.race(promises);
      if (res !== undefined) {
        console.log("Successful response from proxy")
        return res;
      }
    } catch (error) {
      console.error(error);
    }
  }
  console.log('Request failed after 100 attempts');
}
async function get() {
  const MAX_ATTEMPTS = 100;
  const PARALLEL_REQUESTS = 10;
  const returnArray = [];

  const promises = Array.from({ length: PARALLEL_REQUESTS }, () =>
    axios.get('https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?DEALER=1&PRICE_TO=20000', { httpsAgent: agent })
      .then((response) => {
        if (response.status === 200) {
          const temp = response.data.substr(response.data.indexOf('<script id="__NEXT_DATA__" type="application/json">') + '<script id="__NEXT_DATA__" type="application/json">'.length);
          const result = JSON.parse(temp.substr(0, temp.indexOf('</script>')));
          result.props.pageProps.searchResult.advertSummaryList.advertSummary.forEach(returnObj => {
            returnObj.attributes.attribute.forEach(element => {
              returnObj[element.name.toLowerCase()] = isNaN(element.values[0]) ? element.values[0] : +element.values[0];
            });

            // delete useless keys
            delete returnObj.attributes
            delete returnObj.contextLinkList
            delete returnObj.advertiserInfo
            delete returnObj.advertImageList

            returnArray.push({
              index: returnArray.length + 1,
              id: returnObj.id,
              img: returnObj.mmo,
              desc: returnObj.description,
              url: returnObj.seo_url,
              private: returnObj.isprivate
            });
          });
        }
      })
      .catch((error) => console.error(error))
  );

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      await Promise.race(promises);
      if (returnArray.length > 0) {
        console.log("Data proxy failed, retrying...")
        return returnArray;
      }
    } catch (error) {
      console.error(error);
    }
  }
  console.log('Request failed after 100 attempts');
}

function call(){
return get().then(json => {
console.log("Data Api called")
return json //Returns Array of  Objects
})
}

function prettyOutput(car) {
  const carEmoji = "🚗";
  const privateEmoji = "🔒";
  const linkEmoji = "🔗";
  const phoneEmoji = "📞";

  // Create string output
    let output = ''
    output += `${carEmoji} ${car.desc} (${car.id})\n`;
    output += `${phoneEmoji} Phone: ${car.phone}\n`
    output += `${linkEmoji} https://www.willhaben.at/${car.url}\n`;
    //output += `${privateEmoji} Private: ${car.private === 1 ? "Yes" : "No"}\n`;
    output += "------------------------\n";
    output += `https://www.willhaben.at/mmo/${car.img}\n`;
  
  return output;
}

function formatPhone(phone) {
  // Remove any non-digit characters
  if(phone === ""){ return ""}

if (phone !== undefined) {
  phone = phone.replace(/\D/g, '');

    if (phone.startsWith('00')) {
    phone = '00' + phone.slice(2);
  }

  // If the phone number starts with "0", replace with "+43"
  if (phone.startsWith('0')) {
    phone = '0043' + phone.slice(1);
  }

}

  return phone;
}

async function addPhone(items) {
  for (let item of items) {
    console.log(item)
    const phone = await getPhone(item.url);
    
    item.phone = formatPhone(phone);
    //Sending from here is most fastest way to send message.
    console.log("addPhoneItem: "+prettyOutput(item))
    sendMessage(prettyOutput(item))
    
  }
  return items;
}


let processing = false;
async function processData() {
  try {
    // Check if the function is already running
    if (processing) {
      // If so, wait for it to complete before running again
      return await new Promise(resolve => {
        const interval = setInterval(() => {
          if (!processing) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    // Set the processing flag to true
    processing = true;

    // Call the API to get new data
    const newData = await call();

    // Compare the new data with the data received so far
    const newItems = newData.filter(item => !dataReceived.find(d => d.id === item.id));

    // If there are new items, send them using bot.send()
    if (newItems.length > 0) {
      // TODO: Replace this with your bot.send() function call
      //console.log('New items:', addPhone(newItems));
      //da bi se novi oglasi poslali zadnji zato reverse al to mozda i makenmo
      addPhone(newItems.reverse()).then(it => { console.log("New items: " + it)})
    }

    // Remove items from the start of dataSent if it exceeds 50 elements
    while (dataSent.length > 100) {
      dataSent.shift();
    }

    // Add the new data to dataSent and dataReceived arrays
    dataSent.push(...newData);
    dataReceived.push(...newData);
  } catch (err) {
    console.error('Error fetching data:', err);
  } finally {
    // Set the processing flag to false
    processing = false;
  }
}
//setInterval(sendQueuedMessages, sendInterval);
//setInterval(processData, 1000);

module.exports = {processData, sendQueuedMessages}

