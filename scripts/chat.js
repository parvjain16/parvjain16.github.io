// Define global variables
let chatInput;

// Initialize the chatbot by calling the function when the page loads
window.onload = initChatbot;

// Define the function that initializes the chatbot
function initChatbot() {
  // Select the chat form and input elements
  const chatForm = document.getElementById("chat-form");
  chatInput = document.getElementById("chat-input");

  // Add an event listener to the chat form
  chatForm.addEventListener("submit", handleUserInput);
}

// Define the function that handles user input and sends it to the GPT-3 API
async function handleUserInput(event) {
  // Prevent the form from submitting and reloading the page
  event.preventDefault();

  // Get the user input from the chat input field
  const userInput = chatInput.value;

  // Clear the chat input field
  chatInput.value = "";

  // Add the user's message to the chat window
  const chatBody = document.getElementById("chat-body");
  const userMessage = `
    <div class="chat-message user-message">
      <p>${userInput}</p>
    </div>
  `;
  chatBody.innerHTML += userMessage;

  // Send the user's message to the GPT-3 API and get the response
  const response = await fetch("https://api.openai.com/v1/engines/davinci-codex/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer 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"
    },
    body: JSON.stringify({
      prompt: userInput,
      max_tokens: 60,
      n: 1,
      stop: "\n",
      temperature: 0.7
    })
  })
  .then((res) => res.json())
  .then((data) => data.choices[0].text);

  // Add the chatbot's response to the chat window
  const chatbotMessage = `
    <div class="chat-message chatbot-message">
      <p>${response}</p>
    </div>
  `;
  chatBody.innerHTML += chatbotMessage;

  // Scroll the chat window to the bottom
  chatBody.scrollTop = chatBody.scrollHeight;
}
