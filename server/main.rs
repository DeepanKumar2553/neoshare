fn main(){
    let a:i32=234;
    let array:&[i32]=&[1,2,3,4,5];
    let b:&String=&"ashii".to_string();
    println!("hello world {}",a);
    println!("{:?}",array);
    println!("{}",b);
}
