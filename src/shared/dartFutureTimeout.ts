/** Dart Future.timeout stops awaiting without cancelling the original operation. */
export function dartFutureTimeout<T>(future:Promise<T>,milliseconds:number):Promise<T>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('TimeoutException')),milliseconds);future.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
