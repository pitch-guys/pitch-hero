export default () => {
  // eslint-disable-next-line no-restricted-globals
  self.onmessage = (message: any) => {
    const n = message.data;
    let n1 = 0;
    let n2 = 1;
    let sum = 0;
    for (let i = 2; i <= n; i++) {
      sum = (n1 + n2) % 100;
      n1 = n2;
      n2 = sum;
    }
    const result = n ? n2 : n1;

    postMessage(result);
  }
}