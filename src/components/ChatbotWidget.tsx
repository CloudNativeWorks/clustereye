import React, { useEffect } from 'react';

interface ChatbotWidgetProps {
  agentId: string;
  chatbotId: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  buttonBackgroundColor: string;
  startingMessage: string;
  logo: string;
}

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({
  agentId,
  chatbotId,
  name,
  primaryColor,
  secondaryColor,
  buttonBackgroundColor,
  startingMessage,
  logo
}) => {
  // Chatbot Widget'ı yükle
  useEffect(() => {
    // Önce window.doaiChatbot nesnesini oluştur
    const configScript = document.createElement('script');
    configScript.innerHTML = `
      window.doaiChatbot = {
        agentId: "${agentId}",
        chatbotId: "${chatbotId}",
        backgroundColor: 'transparent',
        buttonBackgroundColor: "${buttonBackgroundColor}"
      };
    `;
    document.head.appendChild(configScript);
    
    // Create script element
    const script = document.createElement('script');
    script.src = "https://dxckk6ot3mpqg46buqreyksi.agents.do-ai.run/static/chatbot/widget.js";
    script.async = true;
    script.setAttribute('data-agent-id', agentId);
    script.setAttribute('data-chatbot-id', chatbotId);
    script.setAttribute('data-name', name);
    script.setAttribute('data-primary-color', primaryColor);
    script.setAttribute('data-secondary-color', secondaryColor);
    script.setAttribute('data-button-background-color', buttonBackgroundColor);
    script.setAttribute('data-starting-message', startingMessage);
    script.setAttribute('data-logo', logo);
    script.setAttribute('data-background-color', 'transparent');
    
    // Doğrudan style özelliği ekleme
    script.setAttribute('style', 'background-color: transparent; background: transparent;');
    
    // Script yüklenemediyse
    script.onerror = () => {
      // 5 saniye sonra tekrar yüklemeyi dene
      setTimeout(() => {
        document.body.appendChild(script);
      }, 5000);
    };
    
    // Add custom CSS to make the chatbot background transparent
    const style = document.createElement('style');
    style.textContent = `
      /* ChatGPT widget arka planını şeffaf yapma */
      iframe[src*="agents.do-ai.run"] {
        background: transparent !important;
        border: none !important;
      }
      
      /* Chatbot konteynırını şeffaf yapma */
      [id^="do-agent-chatbot"],
      [id^="do-chatbot"],
      [class*="do-agent-chatbot"],
      [class*="do-chatbot"],
      [class*="do-agent-widget__chatbot"],
      .doai-chatbot-container {
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
      }
      
      /* DigitalOcean'ın önerdiği özel container sınıfı */
      .doai-chatbot-container {
        background-color: transparent !important;
      }
      
      /* Chatbot içindeki içerik panelini şeffaf yapma */
      [class*="do-agent-chatbot__content"],
      [class*="do-chatbot__content"],
      [class*="do-chatbot-content"] {
        background: transparent !important;
      }
      
      /* Chatbot butonunu hedefleyen genişletilmiş seçiciler */
      [class*="do-agent-widget__button"],
      [class*="do-chatbot-button"],
      .doai-chatbot-button,
      .do-ai-chatbot-button,
      .do-agent-widget-button,
      .chatbot-floating-button,
      .doai-chatbot-widget-button,
      [class*="chatbot-button"],
      [class*="widget-button"],
      [class*="floating-button"],
      [class*="chat-button"] {
        background-color: transparent !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      
      /* İframe içindeki butonun arka planını da hedefle */
      iframe[src*="agents.do-ai.run"] button,
      div[class*="do-agent"] button,
      div[class*="do-chatbot"] button,
      div[class*="do-ai"] button {
        background-color: transparent !important;
      }
      
      /* Tailwind CSS sınıflarını kullanan chatbot butonu için doğrudan seçici */
      button.w-16.h-16.flex.shadow.shadow-black\\/50.items-center.justify-center.rounded-full {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      /* Style attribute ile doğrudan tanımlanmış background stilini override et */
      button[style*="background: rgb(79, 13, 134)"] {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      /* DO Chatbot butonları için geniş seçici */
      [class*="w-16"][class*="h-16"][class*="flex"][class*="shadow"][class*="rounded-full"] {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
    
    // Append script to body
    document.body.appendChild(script);
    
    // Cleanup function to remove script when component unmounts
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
      
      if (document.head.contains(configScript)) {
        document.head.removeChild(configScript);
      }
      
      // Also remove any elements added by the chatbot script
      const chatbotElements = document.querySelectorAll('[id^="do-agent-"],[id^="do-chatbot-"],[class*="do-agent"],[class*="do-chatbot"]');
      chatbotElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    };
  }, [
    agentId, 
    chatbotId, 
    name, 
    primaryColor, 
    secondaryColor, 
    buttonBackgroundColor, 
    startingMessage, 
    logo
  ]);
  
  // This component doesn't render anything visible itself
  return null;
};

export default ChatbotWidget;