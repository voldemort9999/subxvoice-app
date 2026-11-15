# SUBXVoice — keep working, say the rest

**A voice helper for Windows that understands Hindi, English, or both in one sentence, and acts on what it hears.**
Built by Bhavesh Parmar and Aarnav Mathakiya on Gnani AI's **Prisma** speech model. **Try it:** [subxvoice.vercel.app](https://subxvoice.vercel.app) · **Code:** [GitHub](https://github.com/voldemort9999/subxvoice-app)

## The problem

A working day keeps breaking into small jobs: a task to note down, a file to find, earbuds to connect, a reply to send. Each one pulls you out of what you were doing. We speak far faster than we type, yet PC voice tools mostly type rather than act. They also expect one language at a time, while much of India speaks in a mix, like *"kal meeting hai, slides ready rakhna"*. And for many people, typing is a barrier in itself.

## The solution

SUBXVoice sits in the tray, and two keys work from inside any app:

- **Follow My Words** (Ctrl + Alt): say a task and it's done in front of you.
- **Dictation** (Ctrl + Win): your words are typed at the cursor. Ask for an email or a message and you get the finished one, in the tone you chose.

## A day with it

| You say | What happens |
|---|---|
| "Notepad kholo aur aaj ke tasks likho: client ko call karna, report bhejna" | Notepad opens and the list is typed (one sentence, two planned steps) |
| "Pictures wale folder mein mera resume dhoondo" | Pictures opens with `My Resume.pdf` selected |
| "OnePlus Buds connect karo" · "brightness 60% kar do" · "YouTube pe Kesariya chalao" | The earbuds connect, the screen is set to 60%, the song plays |
| "WhatsApp pe Aryan ko likho aaj main nahi aa paunga" | The message is typed in his chat. **It is never sent for you** |
| "boss ko email likho ki kal chhutti chahiye, tabiyat theek nahi hai" | A full leave email, signed with your name |
| "ek React pricing table banao, teen tier ka" | The prompt is typed into ChatGPT, as said |

## Built for Indian languages

- **Code-mixed by default.** Switch between Hindi and English mid-sentence on either key and it keeps up. It types Roman letters (the way people chat) or Devanagari, and never translates you.
- **Ten languages in the speech layer.** The Prisma integration accepts Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Punjabi, Tamil, Telugu and Indian English.
- **Hindi-English fixed, on purpose, for now.** In our test, auto-detection heard a Hinglish clip as Telugu. A language picker comes next, and each language is tested before it ships.
- It is tested with background noise, and a personal dictionary fixes names it keeps mishearing.

## How it works

1. Audio streams to **Prisma** while you speak, so letting go waits only for your last words.
2. **Gemini 2.5 Flash** plans the steps before anything runs.
3. **Jev** picks each action or on-screen element. Windows carries out the action, and apps are read as text through UI Automation, with no screenshots.
4. **gpt-oss-120b** writes the emails and the Roman script.

## Safe and shipped

- **Safe:** it never sends a message on its own, and the mic is on only while a key is held. Transcripts stay on your PC. It needs no admin rights and keeps no API keys on the machine.
- **Live:** version 0.4.2 has a public installer and auto-updates. The free beta includes 2 hours a day.
- **Next:** the language picker, then macOS, then apps that draw their own screen.
