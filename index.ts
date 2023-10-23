import { createMachine, createActor, assign, fromPromise } from "xstate";


import { speechstate, Settings, Hypothesis } from "speechstate";

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: "213d2709cc0b4aa7b6511671d9746b97",
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  locale: "en-US",
  asrDefaultNoInputTimeout: 5000,
  ttsDefaultVoice: "en-US-SaraNeural",
};
async function fetchFromChatGPT(prompt: string, max_tokens: number) {
  const myHeaders = new Headers();
  myHeaders.append(
    "Authorization",
    "Bearer ",
  );
  myHeaders.append("Content-Type", "application/json");
  const raw = JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
    temperature: 0,
    max_tokens: 50,
  });

  const response = fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  })
    .then((response) => response.json())
    .then((response) => response.choices[0].message.content);

  return response;
}





interface DMContext {
  spstRef?: any;
  lastResult?: Hypothesis[];
  Destination?: string;
  StartingPoint?: { lat: number; lng: number };
  RoutePreference?: string;
  Stopover?: string;
  userInput?: string;
  recognisedData?: any;
  userCurrentLocation?: { lat: number; lng: number };
}




const grammar = {
  "I want to go to the supermarket": {
    Destination: "supermarket"
  },
  "from home": {
    StartingPoint: '${currentLocation.lat}, Lng: ${currentLocation.lng}'
  },
  "from where I am": {
    StartingPoint: "where you are"
  },
  "stop at the park": {
    Stopover: "park"
  },
  "avoid highways": {
    RoutePreference: "avoid highways"
  },
  "computer": {
    StartingPoint: "Molndal",
    Destination: "Backa",
    RoutePreference: "avoid highways"
  },
  "test sentence": {
    StartingPoint: "Molndal",
    Destination: "Backa",
    RoutePreference: "avoid highways",
    Stopover: "Liseberg"
  },
};



// helper functions
const say =
  (text: string) =>
    ({ context, event }) => {
      context.spstRef.send({
        type: "SPEAK",
        value: { utterance: text },
      });
    };

const listen =
  () =>
    ({ context, event }) =>
      context.spstRef.send({
        type: "LISTEN",
      });

const ToLowerCase = (object: string) => {
  return object.toLowerCase().replace(/\.$/g, "");
    };
const lowerCaseGrammar = Object.keys(grammar).reduce((acc, key) => {
  acc[ToLowerCase(key)] = grammar[key];
  return acc;
}, {});

// machine
const dmMachine = createMachine(
  {
    id: "root",
    type: "parallel",
    states: {
      DialogueManager: {
        initial: "Prepare",
        states: {
          Prepare: {
            on: { ASRTTS_READY: "Ready" },
            entry: [
              assign({
                spstRef: ({ spawn }) => {
                  return spawn(speechstate, {
                    input: {
                      settings: settings,
                    },
                  });
                },
              }),
            ],
          },
          Ready: {
            initial: "Greeting",
            states: {
              Greeting: {
                entry: "speak.greeting",
                on: { SPEAK_COMPLETE: "HowCanIHelp" },
              },
              HowCanIHelp: {
                entry: say("You can say where you want to go."),
                on: { SPEAK_COMPLETE: "Start" },
              },
              Start: {
                entry: listen(),
                on: {
                  RECOGNISED: {
                    target: 'AskchatGPT',
                    actions:[
                      assign({
                        lastResult: ({ event }) => event.value,
                      })
                    ],
                  }
                },
              },
              AskchatGPT:{
                invoke: {
                  src: fromPromise(async({input}) => {
                      const data = await fetchFromChatGPT(
                        input.lastResult[0].utterance + "reply in a json format with entities: StartingPoint, Destination, RoutePreference, Stopover. If I don't mention any of them, leave it empty.",40,
                        );
                        return data;
                    }),
                    input:({context,event}) => ({
                      lastResult: context.lastResult,
                    }),
                    onDone: {
                      actions: [
                        ({ event }) => console.log(JSON.parse(event.output)),
                        assign({
                          StartingPoint: ({ event }) => JSON.parse(event.output).StartingPoint, 
                          Destination: ({ event }) => JSON.parse(event.output).Destination,
                          RoutePreference: ({ event }) => JSON.parse(event.output).RoutePreference,
                          Stopover: ({ event }) => JSON.parse(event.output).Stopover, 
                        }),
                      ],
                      target: 'CheckSlots'
                    }
                      }
                    },
              

    
              SayBack: {
                entry: ({ context }) => {
                    context.spstRef.send({
                        type: "SPEAK",
                        value: { utterance: "Great!" },
                    });
                },
                on: { SPEAK_COMPLETE: "FeedbackAndRepeat" },
              },




              CheckSlots: {
                always: [
                  { target: 'AskStartingPoint', guard: 'isStartingPointMissing' },
                  { target: 'AskDestination', guard: 'isDestinationMissing' },
                  
                  
                  { target: 'FeedbackAndRepeat' },
                ]
                },
                AskStartingPoint: {
                  entry: say('Where would you like to start?'),
                on: { SPEAK_COMPLETE: 'Start' }
              },
                
              
              AskDestination: {
                entry: say('Where would you like to go?'),
                on: { SPEAK_COMPLETE: 'Start' }
              },
              
              AskRoutePreference: {
                entry: ({ context }) => {
                  // 直接将默认的路线偏好用于导航
                  context.RoutePreference = 'no specific preferences';
                },
                on: { SPEAK_COMPLETE: 'Start' }
              },
              
              AskStopover: {
                entry: ({ context }) => {
                  // 直接将默认的路线偏好用于导航
                  context.Stopover = 'no stopover';
                },
                on: { SPEAK_COMPLETE: 'Start' }
              },
              FeedbackAndRepeat: {
                entry: ['navigateFeedback','stopVoiceFunction', ],
                on: {
                  SPEAK_COMPLETE: {
                    target: [ "#root.DialogueManager.Prepare","#root.GUI.PageLoaded"],
                    actions: [
                      // 添加代码将按钮文本设置回 "🎙 Start Voice Command"
                      ({ context }) => {
                        const startVoiceButton = document.getElementById('button');
                        if (startVoiceButton) {
                          
                          startVoiceButton.innerText = '🎙 Start Voice Command';
                          recognition.stop();
                        }
                        const icon1 = document.querySelector('.icon1');
                        if (icon1 instanceof HTMLElement) {
                          icon1.style.display = 'none';
                        }
                      },
                    ],
                  }
                }
              },
            }
          },
        },
      },
          
          GUI: {
            initial: "PageLoaded",
            states: {
            PageLoaded: {
                entry: "gui.PageLoaded",
                on: { 
                  CLICK: { target: "Inactive", actions: "prepare" },
                },
              },
              Inactive: { entry: "gui.Inactive", on: { ASRTTS_READY: "Active" } },
              Active: {
                initial: "Idle",
                states: {
                  Idle: {
                    entry: "gui.Idle", 
                    on: { TTS_STARTED: "Speaking", ASR_STARTED: "Listening" },
                  },
                  Speaking: {
                    entry: ["gui.Speaking", "showIcon1"], // 在进入Speaking状态时调用showIcon1函数
                    on: { SPEAK_COMPLETE: "Idle" },
                  },
                  Listening: {
                    entry: ["gui.Listening", "showIcon2"], // 在进入Listening状态时调用showIcon2函数
                    on: { RECOGNISED: "Idle" },
                  },
                },
              },
            },
          },
        },
      },
  


  {
    guards: {
      isStartingPointMissing: ({ context }) => !context.StartingPoint,
      isDestinationMissing: ({ context }) => !context.Destination,
      
      
    },
    

    actions: {
      prepare: ({ context }) =>
        context.spstRef.send({
          type: "PREPARE",
        }),
      // saveLastResult:
      "speak.greeting": ({ context }) => {
        context.spstRef.send({
          type: "SPEAK",
          value: { utterance: "Hello Jackie" },
        });
      },
      "speak.how-can-I-help": ({ context }) =>
        context.spstRef.send({
          type: "SPEAK",
          value: { utterance: "How can I help you?" },
        }),
      "gui.PageLoaded": ({ }) => {
        document.getElementById("button");
      },
      "gui.Inactive": ({ }) => {
        document.getElementById("button");
      },
      "gui.Idle": ({ }) => {
        document.getElementById("button");
      },
      "gui.Speaking": ({ }) => {
        document.getElementById("button");
      },
      "gui.Listening": ({ }) => {
        document.getElementById("button");
      },
      navigateFeedback: ({ context }) => {
        context.spstRef.send({
          type: "SPEAK",
          value: { utterance: `Ok! Planning the route. Starting navigation!.Have a safe journey` },
        });
        const startName = context.StartingPoint;
        const endName = context.Destination;
        const stopoverName = context.Stopover;  // 获取 stopover 名称
        const routePreference = context.RoutePreference
        navigateUsingPlaceName(startName, endName, stopoverName,routePreference);
      },
      

     
      
      showIcon1: () => {
        const icon1 = document.querySelector('.icon1');
        const icon2 = document.querySelector('.icon2');
        if (icon1 instanceof HTMLElement && icon2 instanceof HTMLElement) {
          icon1.style.display = 'block';
          icon2.style.display = 'none';
        }
      },
  
      // 在系统开始听用户说话时调用该函数，显示图标2
      showIcon2: () => {
        const icon1 = document.querySelector('.icon1');
        const icon2 = document.querySelector('.icon2');
        if (icon1 instanceof HTMLElement && icon2 instanceof HTMLElement) {
          icon1.style.display = 'none';
          icon2.style.display = 'block';
        }
      },
    },
  },
);




function stopVoiceFunction(context) {
  if (context.spstRef) {
    // 停止语音合成
    context.spstRef.send({
      type: "SPEAK_CANCEL",
    });
  }
}


  // 获取图标的元素
  const icon1 = document.getElementById('speak-icon');
  const icon2 = document.getElementById('listen-icon');
const startVoiceButton = document.getElementById('button');
// 在页面加载完成后执行
document.addEventListener('DOMContentLoaded', function () {
  // 获取按钮的元素
  
if (startVoiceButton) {
    startVoiceButton.addEventListener('click', () => {
        isAwake = true;
        recognition.start();
    });
}



  // 初始化按钮的文本
  startVoiceButton.innerText = '🎙 Start Voice Command';

  // 初始化语音状态
  let isVoiceEnabled = false;

  // 创建一个函数来切换语音状态并更新界面
  function toggleVoice() {
    if (isVoiceEnabled) {
      // 如果语音功能已开启，执行退出语音功能的操作
      // 更新状态
      isVoiceEnabled = false;

      // 隐藏图标
      icon1.style.display = 'none';
      icon2.style.display = 'none';

      // 显示按钮
      startVoiceButton.innerText = '🎙 Start Voice Command';
      // 执行退出语音功能的其他逻辑

      // 在这里执行停止语音功能的操作，例如调用停止语音的函数
      stopVoiceFunction;
      recognition.abort(); // 停止语音识别
    interimTranscript = ''; // 清空中间结果
    userUtteranceDiv.innerHTML = '';
    
    } else {
      // 如果语音功能未开启，执行开启语音功能的操作

      // 更新状态
      isVoiceEnabled = true;

      // 显示一个图标，隐藏另一个图标
      if (icon1.style.display === 'block') {
        icon1.style.display = 'none';
        icon2.style.display = 'block';
      } else {
        icon1.style.display = 'block';
        icon2.style.display = 'none';
      }

      // 修改按钮文本
      startVoiceButton.innerText = '🔴 Stop Voice Command';
    }
  }

  // 给按钮添加点击事件监听器，切换语音状态
  startVoiceButton.addEventListener('click', toggleVoice);
});



const actor = createActor(dmMachine).start();


document.addEventListener('DOMContentLoaded', (event) => {
  const button = document.getElementById("button");
  if (button) {
      button.addEventListener('click', () => actor.send({ type: "CLICK" }));
  } else {
      console.error("Button element with id 'start-voice-command' not found.");
  }
});


const wakeUpWord = "my smart car"; // 唤醒词
const userUtteranceDiv = document.getElementById('user-utterance');
        
// Azure 语音服务的订阅密钥和服务区域
const subscriptionKey = 'd0a92233f7b04537a1a2ed319ee90c1a';
const region = 'northeurope';
     
// 创建一个 SpeechRecognition 对象
let interimTranscript = '';
// 创建一个 SpeechRecognition 对象
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US'; // 识别语言
recognition.interimResults = true; // 获取中间结果，即时识别
recognition.continuous = true; // 连续识别

let silenceTimer;
const SILENCE_THRESHOLD = 5000;
let isAwake = false;
// 监听识别结果
recognition.onresult = (event) => {
  const results = event.results;
  const lastResult = results[results.length - 1];
  const transcript = lastResult[0].transcript;
  const isFinal = lastResult.isFinal;
  if (!isAwake) {
    // 如果尚未唤醒系统，检查是否包含唤醒词
    if (transcript.toLowerCase().includes(wakeUpWord.toLowerCase())) {
      isAwake = true; // 唤醒系统
      // 可以在此添加提示或界面更新来指示系统已唤醒
      console.log('System is awake');
      const startVoiceButton = document.getElementById('button');
      if (startVoiceButton) {
        startVoiceButton.click();
      }
      recognition.start();
      recognition.onstart = function() {
        console.log('Speech recognition service has started');
    };
    }
  } else {
    if (!isFinal && transcript !== interimTranscript) {
        // 如果不是最终结果，并且与上一个中间结果不同，将中间结果逐字添加到显示文本框中
        interimTranscript = transcript;
        userUtteranceDiv.innerHTML = interimTranscript;

    } else if (isFinal) {
        // 如果是最终结果，显示整个文本
        interimTranscript = ''; // 清空中间结果
        userUtteranceDiv.innerHTML = transcript;

        // 调用 Azure 语音识别服务将文本发送到 Azure
        // 请参考 Azure 语音服务的文档来实现这一步骤
        recognition.onstart = () => {
          if (!isAwake) {
            recognition.abort(); // 停止当前会话
          }
        };
    }
    }
    clearTimeout(silenceTimer); // 当有新的语音输入时，重置定时器

    silenceTimer = setTimeout(() => {
        recognition.stop();
        document.getElementById('user-utterance').innerHTML = 'If you have any questions, feel free to call my name loudly! Have a safe journey!';

    // 更改icon的显示状态
    icon1.style.display = 'none';
    icon2.style.display = 'none';

    // 更新startVoiceButton的文本
    startVoiceButton.innerText = '🎙 Start Voice Command';
    }, SILENCE_THRESHOLD);

};
// 启动语音识别
recognition.start();

actor.subscribe((state) => {
  console.log(state.value);
});
