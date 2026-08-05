#!/usr/bin/env python3
import sys
import os
import argparse
from mlx_lm import load, generate

MODEL_PATH = "/Volumes/2TB/models/mlx-community/translategemma-27b-it-4bit"

class TranslationEngine:
    def __init__(self, model_path=MODEL_PATH):
        print(f"⏳ 正在加载模型 {model_path} 到 M1 Pro GPU...")
        self.model, self.tokenizer = load(model_path)
        print("✅ 模型加载成功！\n")

    def translate_text(self, text, src_lang="en", tgt_lang="sw", max_tokens=500, temp=0.0, top_p=0.9, system_prompt=None):
        """
        核心翻译函数
        :param max_tokens: 最大生成的 token 数量 (默认 500，小说长章节可设 1500~2000)
        :param temp: 采样温度 (0.0 为确定性精准翻译，推荐；0.2~0.5 为文学润色模式)
        :param top_p: 核采样概率限制
        """
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "source_lang_code": src_lang,
                        "target_lang_code": tgt_lang,
                        "text": text
                    }
                ]
            }
        ]
        
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        
        # 支持自定义附加系统指令 (System Prompt / 人设约束)
        if system_prompt:
            prompt = f"<bos><start_of_turn>system\n{system_prompt}<end_of_turn>\n" + prompt[len("<bos>"): ]
            
        # 调用 MLX 引擎生成
        kwargs = {
            "max_tokens": max_tokens,
        }
        # 若采样温度大于0，则加入 temp 和 top_p
        if temp > 0:
            kwargs["temp"] = temp
            kwargs["top_p"] = top_p
            
        output = generate(self.model, self.tokenizer, prompt=prompt, **kwargs)
        return output.strip()

def main():
    parser = argparse.ArgumentParser(
        description="TranslateGemma 27B 高级本地翻译工具 (全参数配置版)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # 核心输入/输出
    parser.add_argument("text", nargs="?", help="直接输入的待翻译文本/句子")
    parser.add_argument("--file", "-f", help="待翻译的输入文件路径 (.txt)")
    parser.add_argument("--output", "-o", help="翻译结果保存的目标文件路径")
    
    # 语言选择
    parser.add_argument("--src", default="en", help="源语言代码 (如 en, zh, fr)")
    parser.add_argument("--tgt", default="sw", help="目标语言代码 (如 sw, en, zh)")
    
    # 质量与推理控制参数
    parser.add_argument("--max-tokens", "-m", type=int, default=1000, help="最大生成的 Token 数量 (小说长段落建议 1000-2000)")
    parser.add_argument("--temp", "-t", type=float, default=0.0, help="采样温度: 0.0 为确定性直译(推荐); 0.2-0.5 为文学润色")
    parser.add_argument("--top-p", type=float, default=0.9, help="核采样概率上限 (仅当 temp > 0 时生效)")
    parser.add_argument("--system", help="自定义规则/人设约束 (如: '保持严肃语气，人名不翻译')")
    
    args = parser.parse_args()
    
    if not args.text and not args.file:
        parser.print_help()
        sys.exit(1)
        
    engine = TranslationEngine()
    
    if args.text:
        print(f"📖 原始文本 ({args.src}): {args.text}")
        result = engine.translate_text(
            args.text, 
            src_lang=args.src, tgt_lang=args.tgt, 
            max_tokens=args.max_tokens, temp=args.temp, top_p=args.top_p,
            system_prompt=args.system
        )
        print(f"\n🌍 翻译结果 ({args.tgt}):\n{result}\n")
        
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(result)
            print(f"💾 结果已保存至: {args.output}")

    elif args.file:
        if not os.path.exists(args.file):
            print(f"❌ 错误: 找不到文件 {args.file}")
            sys.exit(1)
            
        with open(args.file, "r", encoding="utf-8") as f:
            content = f.read()
            
        print(f"📄 正在翻译文件: {args.file} (共 {len(content)} 字符)...")
        result = engine.translate_text(
            content, 
            src_lang=args.src, tgt_lang=args.tgt, 
            max_tokens=args.max_tokens, temp=args.temp, top_p=args.top_p,
            system_prompt=args.system
        )
        
        print("\n=== 翻译结果预览 ===")
        print(result[:500] + ("...\n(后续省略)" if len(result) > 500 else ""))
        
        output_file = args.output if args.output else f"{args.file}.translated.{args.tgt}.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"\n💾 完整译文已成功保存至文件: {output_file}")

if __name__ == "__main__":
    main()
