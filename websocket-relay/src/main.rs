#![allow(unused_variables, unused_mut, dead_code)]

use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_hdr_async, tungstenite::Message, WebSocketStream};
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use futures_util::{StreamExt, SinkExt, stream::SplitSink, stream::SplitStream};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use url::Url;


async fn is_http_request(stream: &TcpStream) -> Result<bool, std::io::Error> {
    let mut buffer = [0u8; 16];
    stream.peek(&mut buffer).await?;
    let request = String::from_utf8_lossy(&buffer);
    Ok(request.starts_with("GET /") || request.starts_with("POST /") || request.starts_with("HEAD /"))
}

async fn handle_http_health_check(mut stream: TcpStream) -> Result<(), std::io::Error> {
    use tokio::io::AsyncWriteExt;
    println!("Handling HTTP health check");
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\n\r\nOK";
    stream.write_all(response.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}


struct Room {
    room_code: String,
    sender: Option<SplitSink<WebSocketStream<TcpStream>, Message>>,
    receiver: Option<SplitSink<WebSocketStream<TcpStream>, Message>>,
}

impl Room {
    fn new(room_code: String) -> Self {
        println!("Creating new room: {}", room_code);
        Room {
            room_code,
            sender: None,   
            receiver: None,   
        }
    }
    
    fn is_complete(&self) -> bool {
        self.sender.is_some() && self.receiver.is_some()
    }
}

type Rooms = Arc<Mutex<HashMap<String, Room>>>;

#[tokio::main]
async fn main() {
    println!("Starting WebSocket Relay Server with Room Management...");
    
    let rooms: Rooms = Arc::new(Mutex::new(HashMap::new()));
    
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr)
    .await
      .expect(&format!("Failed to bind to port {}", port));

      println!("Server listening on ws://0.0.0.0:{}", port);
   
    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                if let Ok(true) = is_http_request(&stream).await {
                    tokio::spawn(async move {
                        let _ = handle_http_health_check(stream).await;
                    });
                    continue;
                }
               
                let rooms_clone = rooms.clone();
               
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, rooms_clone).await {
                        eprintln!("Error handling connection: {}", e);
                    }
                });
            }
            Err(e) => {
                eprintln!("Failed to accept connection: {}", e);
            }
        }
    }
}

async fn handle_connection(
    stream: TcpStream,
    rooms: Rooms,
) -> Result<(), Box<dyn std::error::Error>> {
    let addr = stream.peer_addr()?;
    
    let mut room_code = String::new();
    let mut role = String::new();
    
    let callback = |req: &Request, response: Response| {
        let uri_str = req.uri().to_string();
        
        if let Ok(url) = Url::parse(&format!("http://dummy{}", uri_str)) {
            for (key, value) in url.query_pairs() {
                match key.as_ref() {
                    "room" => room_code = value.to_string(),
                    "role" => role = value.to_string(),
                    _ => {}
                }
            }
        }
        
        // if !room_code.is_empty() && !role.is_empty() {
        //     println!("Parsed from URL - Room: {}, Role: {}", room_code, role);
        // }
        
        Ok(response)
    };
    
    // let ws_stream = accept_hdr_async(stream, callback)
    //     .await
    //     .expect("Failed to accept WebSocket");
    
    let ws_stream = match accept_hdr_async(stream, callback).await {
        Ok(ws) => ws,
        Err(e) => {
              println!("Failed to accept WebSocket connection from {}: {:?}", addr, e);
               return Ok(()); 
             }
            };
    
    if room_code.is_empty() || role.is_empty() {
        println!("Missing room or role in URL");
        return Ok(());
    }
    
    println!("Using Room: {}, Role: {}", room_code, role);
    
    let (write, mut read) = ws_stream.split();
  
    let mut rooms_map = rooms.lock().await;
   
    let room = rooms_map
        .entry(room_code.clone())
        .or_insert_with(|| Room::new(room_code.clone()));
   
    if role == "sender" {
        if room.sender.is_some() {
            println!("Sender already exists in room {}", room_code);
            return Ok(());
        }
        room.sender = Some(write);
        println!("Sender joined room {}", room_code);
    } else if role == "receiver" {
        if room.receiver.is_some() {
            println!("Receiver already exists in room {}", room_code);
            return Ok(());
        }
        room.receiver = Some(write);
        println!("Receiver joined room {}", room_code);
    } else {
        println!("Invalid role: {}", role);
        return Ok(());
    }
    
    let is_complete = room.is_complete();
    
    drop(rooms_map);
    
    if is_complete {
        println!("Room {} is complete! Starting relay...", room_code);
       
        relay_messages(read, rooms.clone(), room_code.clone(), role.clone()).await?;
    } else {
        println!("Waiting for {} in room {}...", 
            if role == "sender" { "receiver" } else { "sender" },
            room_code
        );
        
        wait_for_peer(read, rooms.clone(), room_code.clone(), role.clone()).await?;
    }
    
    let mut rooms_map = rooms.lock().await;
    if let Some(room) = rooms_map.get_mut(&room_code) {
        if role == "sender" {
            room.sender = None;
            println!("Sender left room {}", room_code);
        } else {
            room.receiver = None;
            println!("Receiver left room {}", room_code);
        }
       
        if room.sender.is_none() && room.receiver.is_none() {
            rooms_map.remove(&room_code);
            println!("Room {} removed (empty)", room_code);
        }
    }
    
    Ok(())
}

async fn wait_for_peer(
    mut read: SplitStream<WebSocketStream<TcpStream>>,
    rooms: Rooms,
    room_code: String,
    role: String,
) -> Result<(), Box<dyn std::error::Error>> {
    loop {
        let is_complete = {
            let rooms_map = rooms.lock().await;
            if let Some(room) = rooms_map.get(&room_code) {
                room.is_complete()
            } else {
                false
            }
        };
        
        if is_complete {
            println!("{} in room {}: Peer joined! Starting relay...", role, room_code);
            relay_messages(read, rooms.clone(), room_code, role).await?;
            break;
        }
        
        match tokio::time::timeout(
            tokio::time::Duration::from_millis(100),
            read.next()
        ).await {
            Ok(Some(result)) => {
                match result {
                    Ok(Message::Close(_)) => {
                        println!("{} in room {} disconnected while waiting", role, room_code);
                        break;
                    }
                    Ok(Message::Text(text)) => {
                        println!("{} tried to send message while waiting (ignored): {}", role, text);
                    }
                    Ok(Message::Binary(data)) => {
                        println!("{} tried to send {} bytes while waiting (ignored)", role, data.len());
                    }
                    Err(e) => {
                        println!("Error while waiting: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            Ok(None) => {
                println!("{} connection closed while waiting", role);
                break;
            }
            Err(_) => {
                continue;
            }
        }
    }
    
    Ok(())
}

async fn relay_messages(
    mut read: SplitStream<WebSocketStream<TcpStream>>,
    rooms: Rooms,
    room_code: String,
    role: String,
) -> Result<(), Box<dyn std::error::Error>> {
    while let Some(result) = read.next().await {
        match result {
            Ok(msg) => {
                match msg {
                    Message::Text(text) => {
                        // println!("{} sent text: {}", role, text);
                       
                        forward_message(&rooms, &room_code, &role, Message::Text(text)).await?;
                    }
                    Message::Binary(data) => {
                        // println!("{} sent {} bytes", role, data.len());
                       
                        forward_message(&rooms, &room_code, &role, Message::Binary(data)).await?;
                    }
                    Message::Close(_) => {
                        // println!("{} closed connection in room {}", role, room_code);

                        break;
                    }
                    _ => {
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading message from {}: {}", role, e);
                break;
            }
        }
    }
    
    Ok(())
}

async fn forward_message(
    rooms: &Rooms,
    room_code: &str,
    from_role: &str,
    message: Message,
) -> Result<(), Box<dyn std::error::Error>> {
    let target_role = if from_role == "sender" {
        "receiver"
    } else {
        "sender"
    };
   
    let writer_option = {
        let mut rooms_map = rooms.lock().await;  // LOCK
        
        if let Some(room) = rooms_map.get_mut(room_code) {
            let target_writer = if target_role == "sender" {
                &mut room.sender
            } else {
                &mut room.receiver
            };
          
            target_writer.take()
        } else {
            None
        }
    }; 
    
    if let Some(mut writer) = writer_option {
        let send_result = writer.send(message).await;
       
        {
            let mut rooms_map = rooms.lock().await;
            
            if let Some(room) = rooms_map.get_mut(room_code) {
                if target_role == "sender" {
                    room.sender = Some(writer);
                } else {
                    room.receiver = Some(writer);
                }
            }
        } 
        
        send_result?;
    } else {
        println!("{} not connected in room {}", target_role, room_code);
    }
    
    Ok(())
}