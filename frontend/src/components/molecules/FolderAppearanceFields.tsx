import { Input } from '@/components/ui/input';
import { folderColorOptions, folderIconOptions, normalizeFolderColor } from '@/lib/folder-visual';

export function FolderAppearanceFields({
  color,
  iconUrl,
  onColorChange,
  onIconChange,
}: {
  color: string;
  iconUrl: string;
  onColorChange: (color: string) => void;
  onIconChange: (iconUrl: string) => void;
}) {
  const normalizedColor = normalizeFolderColor(color);
  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold">
        Folder Color
        <Input
          type="color"
          value={normalizedColor}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-12 p-1"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {folderColorOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onColorChange(option)}
            className={
              normalizedColor === option
                ? 'h-8 w-8 rounded-sm border-2 border-ring'
                : 'h-8 w-8 rounded-sm border border-border'
            }
            style={{ backgroundColor: option }}
            aria-label={`Use ${option} folder color`}
          />
        ))}
      </div>
      <div className="grid gap-2 text-sm font-semibold">
        <span>Folder Icon</span>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {folderIconOptions.map((option) => (
            <button
              key={option.url}
              type="button"
              onClick={() => onIconChange(option.url)}
              className={
                iconUrl === option.url
                  ? 'flex h-12 items-center justify-center rounded-sm border-2 border-ring bg-primary/10 p-2'
                  : 'flex h-12 items-center justify-center rounded-sm border border-border bg-muted p-2'
              }
              title={option.label}
              aria-label={`Use ${option.label} icon`}
            >
              <img
                src={`${option.url}?color=${encodeURIComponent(normalizedColor)}`}
                alt=""
                className="h-6 w-6"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
