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
  asrDefaultNoInputTimeout: 0,
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
  Mode?: string; // warm or cool
  Switch?: string ; // on or off
  Intensity?: string; // weak, strong, or medium
  Temperature?: string; // high or low 
  Direction?: string; // body,legs or loop (which is the whole car)
  lofiStart?:string;
  jazzStart?:string;
  funkStart?:string;
  fadeStart?:string;
}




const grammar = {
  "go home": {
    StartingPoint: "Humanistiska Fakulteten",
    Destination: "Frälsegårdsgatan"
  },
  "navigate to my office": {
    StartingPoint: "Humanistiska Fakulteten",
    Destination: "Lindholmen Science Park"
  },
  "show my regular route": {
    StartingPoint: "Molndal",
    Destination: "Backa",
    RoutePreference: "avoid highways",
    Stopover: "Liseberg"
  },
  "hello": {
    Switch: "on",
    Direction: "towards legs",
    Mode: "cool",
    Temperature: "high",
  },

  "legs": {
    Switch: "on",
    Direction: "towards legs",
  },
  "body": {
    Switch: "on",
    Direction: "towards body",
  },
  "loop": {
    Switch: "on",
    Direction: "loop",
  },
  "cool": {
    Switch: "on",
    Mode: "cool",
  },
  "warm": {
    Switch: "on",
    Mode: "warm",
  },
  "high": {
    Switch: "on",
    Temperature: "high",
  },
  "low": {
    Switch: "on",
    Temperature: "low",
  },
  "weak": {
    Switch: "on",
    Intensity:"weak"
  },
  "medium": {
    Switch: "on",
    Intensity:"medium"
  },
  "strong": {
    Switch: "on",
    Intensity:"strong"
  },
  "start Lofi": {
    lofiStart: "on"
  },
  "start Jazz": {
    jazzStart: "on"
  },
  "start Funk": {
    funkStart: "on"
  },
  "start Fade": {
    fadeStart: "on"
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
                entry: listen(),
                on: {
                  RECOGNISED: [
                    { target: "ChangeImageForLeftSeatHeater", guard: "isTurnOnLeftSeatHeaterCommand" },
                    { target: "ChangeImageForRightSeatHeater", guard: "isTurnOnRightSeatHeaterCommand" },
                    { target: "ChangeImageForDefogFront", guard: "isDefogFrontWindowCommand" },
                    { target: "ChangeImageForDefogBack", guard: "isDefogBackWindowCommand" },
                    { target: "ACFunction", guard: "isACOn" },
                    { target: "Playlofi", guard: "lofiOn" },
                    { target: "Playjazz", guard: "jazzOn" },
                    { target: "Playfunk", guard: "funkOn" },
                    { target: "Playfade", guard: "fadeOn" },
                    {
                      actions: 
                      assign({
                        lastResult: ({ event }) => {
                          console.log("Event RECOGNISED triggered", event);
                          return event.value;
                        },
                      }),
                      target: 'CheckGrammarMatch'
                    }
                  ]
                }
              },
              Playlofi: {
                entry: ['Playlofi'],
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
              Playjazz: {
                entry: ['Playjazz'],
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
              Playfunk: {
                entry: ['Playfunk'],
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
              Playfade: {
                entry: ['Playfade'],
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


              ChangeImageForLeftSeatHeater: {
                entry: ['changeImageForLeftSeat'],
                after: {
                  30: '#root.DialogueManager.Prepare' // 50ms之后返回初始状态
                }
              },
              ChangeImageForRightSeatHeater: {
                entry: ['changeImageForRightSeat'],
                after: {
                  30: '#root.DialogueManager.Prepare' // 50ms之后返回初始状态
                }
              },
              ChangeImageForDefogFront: {
                entry: ['changeImageForDefogFront'],
                after: {
                  30: '#root.DialogueManager.Prepare' // 50ms之后返回初始状态
                }
              },
              ChangeImageForDefogBack: {
                entry: ['changeImageForDefogBack'],
                after: {
                  30: '#root.DialogueManager.Prepare' // 50ms之后返回初始状态
                }
              },
              ACFunction:{
                entry:[say("Swithch is on. Do you want to change settings?"),'changeImageForFan'],
                on:{ SPEAK_COMPLETE: "settingdecision"}
              },
              settingdecision:{
                entry:listen(),
                on:{
                  RECOGNISED:[
                    {
                      target:"ACFunctionComplete",
                      guard: ({context,event}) => {
                        const userInput = ToLowerCase(event.value[0].utterance)
                        return userInput === "no";
                      },
                    },
                    {
                      target: "ACFunctionChoose",
                      guard: ({ context, event }) => {
                        const userInput = ToLowerCase(event.value[0].utterance)
                        return userInput === "yes";
                      },
                    },
                  ]
                }
              },
              ACFunctionComplete: {
                entry: say("Alright. Have a safe journey."),
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
              },
            },
              ACFunctionChoose: {
                entry: say("You can choose your preferred mode, intensity, temperature, and direction. Let's strat with choosing the mode."),
                on: { SPEAK_COMPLETE: "ACFunctionChooing" },
              },
              ACFunctionChooing: {
                entry: listen(),
                on: {
                  RECOGNISED: {
                    actions: [
                      ({ event }) => console.log(event),
                      assign({
                        userInput: ({ event }) => event.value[0].utterance,
                        Switch: ({ context, event }) => {
                          const userInput = ToLowerCase(event.value[0].utterance);
                          return lowerCaseGrammar[userInput]?.Switch || context.Switch;
                        },
                        Mode: ({ context, event }) => {
                          const userInput = ToLowerCase(event.value[0].utterance);
                          return lowerCaseGrammar[userInput]?.Mode || context.Mode;
                        },
                        Intensity: ({ context, event }) => {
                          const userInput = ToLowerCase(event.value[0].utterance);
                          return lowerCaseGrammar[userInput]?.Intensity || context.Intensity;
                        },
                        Direction: ({ context, event }) => {
                          const userInput = ToLowerCase(event.value[0].utterance);
                          return lowerCaseGrammar[userInput]?.Direction || context.Direction;
                        },
                        Temperature: ({ context, event }) => {
                          const userInput = ToLowerCase(event.value[0].utterance);// Using toLowerCase instead of ToLowerCase
                          return lowerCaseGrammar[userInput]?.Temperature || context.Temperature;
                        },
                      }),
                    ],
                    target: 'CheckSlotsforAC'
                  }
                },
              },
              CheckSlotsforAC: {
                always: [
                  { target: 'AskMode', guard: 'isModeMissing' },
                  { target: 'AskDirection', guard: 'isDirectionMissing' },
                  { target: 'AskTemperature', guard: 'isTemperatureMissing' },
                  { target: 'AskIntensity', guard: 'isIntensityMissing' },
                  { target: 'AskSwitch', guard: 'isSwitchMissing' },
                  { target: 'ACFunctionFeedback' }, 
                ]
                },
              AskMode: {
                entry: say('Which Mode would you like?'),
                on:{ SPEAK_COMPLETE: 'ACFunctionChooing' }
              },
              AskDirection: {
                entry: say('Which Direction would you like?'),
                on: { SPEAK_COMPLETE: 'ACFunctionChooing' }
              },
              AskTemperature: {
                entry: say('Which Temperature would you like?'),
                on: { SPEAK_COMPLETE: 'ACFunctionChooing' }
              },
              AskIntensity: {
                entry: say('Which Intensity would you like?'),
                on: { SPEAK_COMPLETE: 'ACFunctionChooing' }
              },
              AskSwitch: {
                entry: say('Switch is on.'),
                on: { SPEAK_COMPLETE: 'ACFunctionChooing' }
              },
              ACFunctionFeedback: {
                entry: 'ACFunctionSettingCompelete',
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





              CheckGrammarMatch: {
                always: [
                        { target: 'UseGrammarData', guard: 'isInputMatchingGrammar' },
                        { target: 'AskchatGPT' }
                    ]
                },
                
                UseGrammarData: {
                  entry: [
                    ({ event }) => console.log("Entered UseGrammarData with event:", event),
                
                    assign({
                      userInput: ({ event }) => {
                        const userInputValue = event.value[0].utterance;
                        console.log("Assigning userInput:", userInputValue);
                        return userInputValue;
                      },
                    }),
                    assign({
                      Destination: ({ context }) => {
                        const userInput = ToLowerCase(context.userInput);
                        const matchedDestination = lowerCaseGrammar[userInput]?.Destination || context.Destination;
                        return matchedDestination;
                      },
                    }),
                    assign({
                      StartingPoint: ({ context }) => {
                        const userInput = ToLowerCase(context.userInput);
                        const matchedStartingPoint = lowerCaseGrammar[userInput]?.StartingPoint || context.StartingPoint;
                        return matchedStartingPoint;
                      },
                    }),
                    assign({
                      RoutePreference: ({ context }) => {
                        const userInput = ToLowerCase(context.userInput);
                        const matchedRoutePreference = lowerCaseGrammar[userInput]?.RoutePreference || context.RoutePreference;
                        return matchedRoutePreference;
                      },
                    }),
                    assign({
                      Stopover: ({ context }) => {
                        const userInput = ToLowerCase(context.userInput);
                        const matchedStopover = lowerCaseGrammar[userInput]?.Stopover || context.Stopover;
                        return matchedStopover;
                      },
                    }),
                  ],
                  always: { target: "CheckSlots" }
                },
                
                AskchatGPT:{
                invoke: {
                  src: fromPromise(async({input}) => {
                      const data = await fetchFromChatGPT(
                        input.lastResult[0].utterance + "reply in a json format with entities: StartingPoint, Destination, RoutePreference, Stopover. If I don't mention any of them, leave it empty.  Only only lonly if StratingPoint is empty, then set StartingPoint to Humanistiska Fakulteten.",40,
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

                    NoRouteAvailable: {
                      entry: 'notifyNoRouteAvailable',
                  },



              CheckSlots: {
                always: [
                  { target: 'AskStartingPoint', guard: 'isStartingPointMissing' },
                  { target: 'AskDestination', guard: 'isDestinationMissing' },
                  { target: 'FeedbackAndRepeat' },
                ],
                },
                
                
                AskStartingPoint: {
                  entry: say('Where would you like to start?'),
                  on: { SPEAK_COMPLETE: 'HowCanIHelp' }
                },
              AskDestination: {
                entry: say('Where would you like to go?'),
                on: { SPEAK_COMPLETE: 'HowCanIHelp' }
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
        isModeMissing: ({ context }) => !context.Mode,
        isDirectionMissing: ({ context }) => !context.Direction,
        isTemperatureMissing: ({ context }) => !context.Temperature, 
        isIntensityMissing: ({ context }) => !context.Intensity,
        isSwitchMissing: ({ context }) => !context.Switch,
      isStartingPointMissing: ({ context }) => !context.StartingPoint,
      isDestinationMissing: ({ context }) => !context.Destination,
      isInputMatchingGrammar: ({ context, event }) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        console.log("User input:", userInput);
        console.log("Matching grammar:", !!lowerCaseGrammar[userInput]);
        return !!lowerCaseGrammar[userInput];
    },
      isTurnOnLeftSeatHeaterCommand: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "turn on left seat heater";
      },
      isTurnOnRightSeatHeaterCommand: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "turn on right seat heater";
      },
      isDefogFrontWindowCommand: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "turn on front window defogging";
      },
      isDefogBackWindowCommand: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "turn on back window defogging";
      },
      isACOn: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "turn air conditioner on";
      },
      lofiOn: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "play lofi";
      },
      jazzOn: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "play jazz";
      },
      funkOn: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "play funk";
      },
      fadeOn: ({context, event}) => {
        const userInput = ToLowerCase(event.value[0].utterance);
        return userInput === "play fade";
      },
    },
    

    actions: {
      prepare: ({ context }) =>
        context.spstRef.send({
          type: "PREPARE",
        }),
        notifyNoRouteAvailable: ({ context }) => {
          context.spstRef.send({
            type: "SPEAK",
            value: { utterance: "Wrong way!" },
          });
        },
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
          value: { utterance: `Planning the route. Starting navigation!.Have a safe journey` },
        });
        const startName = context.StartingPoint;
        const endName = context.Destination;
        const stopoverName = context.Stopover;  // 获取 stopover 名称
        const routePreference = context.RoutePreference
        navigateUsingPlaceName(startName, endName, stopoverName,routePreference);
      },
      changeImageForLeftSeat: () => {
        const buttonOff = document.getElementById('left-seat-off');
        const buttonOn = document.getElementById('left-seat-on');
        if (buttonOff && buttonOn) {
            if (buttonOff.style.display === 'none') {
                buttonOff.style.display = 'inline-block';
                buttonOn.style.display = 'none';
            } else {
                buttonOff.style.display = 'none';
                buttonOn.style.display = 'inline-block';
            }
            // 假设您的语音识别对象是 recognition
            if (typeof recognition !== 'undefined') {
                recognition.stop();
            }
            resetInterface()
        } 
    },
    changeImageForRightSeat: () => {
      const buttonOff = document.getElementById('right-seat-off');
      const buttonOn = document.getElementById('right-seat-on');
      if (buttonOff && buttonOn) {
          if (buttonOff.style.display === 'none') {
              buttonOff.style.display = 'inline-block';
              buttonOn.style.display = 'none';
          } else {
              buttonOff.style.display = 'none';
              buttonOn.style.display = 'inline-block';
          }
          // 假设您的语音识别对象是 recognition
          if (typeof recognition !== 'undefined') {
              recognition.stop();
          }
          resetInterface()
      } 
  },
  changeImageForDefogFront: () => {
    const buttonOff = document.getElementById('front-windshield-off');
    const buttonOn = document.getElementById('front-windshield-on');
    if (buttonOff && buttonOn) {
        if (buttonOff.style.display === 'none') {
            buttonOff.style.display = 'inline-block';
            buttonOn.style.display = 'none';
        } else {
            buttonOff.style.display = 'none';
            buttonOn.style.display = 'inline-block';
        }
        // 假设您的语音识别对象是 recognition
        if (typeof recognition !== 'undefined') {
            recognition.stop();
        }
        resetInterface()
    } 
},
changeImageForDefogBack: () => {
  const buttonOff = document.getElementById('back-windshield-off');
  const buttonOn = document.getElementById('back-windshield-on');
  if (buttonOff && buttonOn) {
      if (buttonOff.style.display === 'none') {
          buttonOff.style.display = 'inline-block';
          buttonOn.style.display = 'none';
      } else {
          buttonOff.style.display = 'none';
          buttonOn.style.display = 'inline-block';
      }
      // 假设您的语音识别对象是 recognition
      if (typeof recognition !== 'undefined') {
          recognition.stop();
      }
      resetInterface();
  } 
},
changeImageForFan: () => {
  const buttonOff = document.getElementById('fan-off');
  const buttonOn = document.getElementById('fan-on');
  if (buttonOff && buttonOn) {
      if (buttonOff.style.display === 'none') {
          buttonOff.style.display = 'inline-block';
          buttonOn.style.display = 'none';
      } else {
          buttonOff.style.display = 'none';
          buttonOn.style.display = 'inline-block';
      }
      // 假设您的语音识别对象是 recognition
      if (typeof recognition !== 'undefined') {
          recognition.stop();
      }
      resetInterface();
  } 
},
ACFunctionSettingCompelete: ({ context }) => {
  context.spstRef.send({
    type: "SPEAK",
    value: { utterance: `Alright,the air-conditioner is turn ${context.Switch}, on ${context.Mode} mode and on ${context.Intensity} intensity, the temperature is ${context.Temperature},the direction is ${context.Direction}` },
  });
},

Playlofi:  ({ }) => { 
  const lofiPlayer = document.getElementById('lofi');
(lofiPlayer as any).src += "&autoplay=1";
},

Playjazz:  ({ }) => { 
  const jazzPlayer = document.getElementById('jazz');
(jazzPlayer as any).src += "&autoplay=1";
},

Playfunk:  ({ }) => { 
  const funkPlayer = document.getElementById('funk');
(funkPlayer as any).src += "&autoplay=1";
},

Playfade:  ({ }) => { 
  const fadePlayer = document.getElementById('fade');
(fadePlayer as any).src += "&autoplay=1";
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
function resetInterface() {
  // 重置界面元素
  const speakIcon = document.getElementById('speak-icon');
  const listenIcon = document.getElementById('listen-icon');
  const userUtterance = document.getElementById('user-utterance');
  const startButton = document.getElementById('button');

  if (speakIcon && listenIcon && userUtterance && startButton) {
    speakIcon.style.display = 'none';
    listenIcon.style.display = 'none';
    userUtterance.textContent = 'If you have any questions, feel free to call my name loudly! Have a safe journey!';
    startButton.textContent = '🎙 Start Voice Command';
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


const wakeUpWord = "hello my car"; // 唤醒词
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
const SILENCE_THRESHOLD = 3000;
let isAwake = false;
// 监听识别结果
recognition.onresult = (event) => {
  const results = event.results;
  const lastResult = results[results.length - 1];
  const transcript = lastResult[0].transcript;
  const isFinal = lastResult.isFinal;
  if (!isAwake) {
    if (transcript.toLowerCase().includes(wakeUpWord.toLowerCase())) {
      isAwake = true; // 唤醒系统
    
      const startVoiceButton = document.getElementById('button');
      if (startVoiceButton) {
        startVoiceButton.click();
      }
      
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
