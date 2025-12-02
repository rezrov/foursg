This is my blog

[[That time I did something in 2024]]
[[Early 2025 Happenings]]
[[Later 2025 Happenings]]


| box1 | box2 |
| ---- | ---- |
| box3 | box4 |

---

```
async clearOutputDirectory(): Promise<void> {  
    this.log(`Clearing generated site directory: ${this.sitePath}`);  
    await this.removeDirectoryRecursive(this.sitePath);  
}
```